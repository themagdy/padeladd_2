<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

// Update last build used if provided (only for self)
if (isset($data['app_build_ref']) && !isset($data['target_id']) && !isset($data['player_code'])) {
    $ref = $data['app_build_ref'];
    if ($ref === 'Web') {
        // Web visit — update legacy field + web timestamp
        $stmtUp = $pdo->prepare("UPDATE users SET last_build_ref = ?, last_web_active = NOW() WHERE id = ?");
        $stmtUp->execute([$ref, $user['id']]);
    } else {
        // Native app visit — update legacy field + native build version
        $stmtUp = $pdo->prepare("UPDATE users SET last_build_ref = ?, last_native_build = ? WHERE id = ?");
        $stmtUp->execute([$ref, $ref, $user['id']]);
    }
}

// Logic: If target_id or player_code is provided, fetch THAT user. Otherwise, fetch self.
$targetId = $data['target_id'] ?? null;
$playerCode = isset($data['player_code']) ? strtoupper(trim($data['player_code'])) : null;

if ($playerCode) {
    // Find user by player_code
    $stmtFind = $pdo->prepare("SELECT user_id FROM user_profiles WHERE player_code = ?");
    $stmtFind->execute([$playerCode]);
    $found = $stmtFind->fetch();
    if (!$found) jsonResponse(false, 'Player not found.');
    $viewingId = (int)$found['user_id'];
} elseif ($targetId) {
    $viewingId = (int)$targetId;
} else {
    $viewingId = (int)$user['id'];
}

// Get basic user info
$stmtUser = $pdo->prepare("SELECT id, first_name, last_name, email, mobile FROM users WHERE id = ? AND status = 'active'");
$stmtUser->execute([$viewingId]);
$u = $stmtUser->fetch();
if (!$u) jsonResponse(false, 'User not found.');

// Get profile info
$stmtProf = $pdo->prepare("
    SELECT up.*, l.name AS location_name 
    FROM user_profiles up
    LEFT JOIN locations l ON up.location_id = l.id
    WHERE up.user_id = ?
");
$stmtProf->execute([$viewingId]);
$profile = $stmtProf->fetch();

// Get stats
$stmtStats = $pdo->prepare("SELECT * FROM player_stats WHERE user_id = ?");
$stmtStats->execute([$viewingId]);
$stats = $stmtStats->fetch();

// Calculate age if DOB available
$age = null;
if ($profile && $profile['date_of_birth']) {
    $dob = new DateTime($profile['date_of_birth']);
    $now = new DateTime();
    $age = (int)$dob->diff($now)->y;
}

// Win rate (integer only, per rules)
$winRate = 0;
if ($stats && $stats['matches_played'] > 0) {
    $winRate = intval(($stats['matches_won'] * 100) / $stats['matches_played']);
}

// Calculate rank on the fly using rank_points (competition merit only)
$currentRanking = null;
$rankingChange  = null;
if ($profile && $stats) {
    $gender = $profile['gender'] ?? 'male';
    $rankStmt = $pdo->prepare("
        SELECT COUNT(*) + 1
        FROM player_stats ps
        JOIN user_profiles up ON ps.user_id = up.user_id
        WHERE up.gender = ? AND ps.rank_points > ?
    ");
    $rankStmt->execute([$gender, (int)($stats['rank_points'] ?? 0)]);
    $currentRanking = (int)$rankStmt->fetchColumn();
    if ($stats['previous_ranking'] && $currentRanking) {
        $rankingChange = $stats['previous_ranking'] - $currentRanking;
    }

    // Calculate rolling 7-day points
    $rollingStmt = $pdo->prepare("
        SELECT COALESCE(SUM(mp.point_change), 0)
        FROM match_players mp
        JOIN matches m ON mp.match_id = m.id
        WHERE mp.user_id = ? 
          AND m.status = 'completed'
          AND m.match_type = 'competition'
          AND m.match_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ");
    $rollingStmt->execute([$viewingId]);
    $pointsThisWeek = (int)$rollingStmt->fetchColumn();
}


// Phase 9: Stories & Social
$storyStmt = $pdo->prepare("
    SELECT 1 FROM stories s 
    JOIN match_players mp ON s.match_id = mp.match_id 
    WHERE mp.user_id = ? AND s.is_active = 1 AND s.expires_at > NOW() 
    LIMIT 1
");
$storyStmt->execute([$viewingId]);
$hasActiveStory = (bool)$storyStmt->fetchColumn();

$isFollowing = false;
if ($viewingId !== $user['id']) {
    $fStmt = $pdo->prepare("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?");
    $fStmt->execute([$user['id'], $viewingId]);
    $isFollowing = (bool)$fStmt->fetchColumn();
}

$followersStmt = $pdo->prepare("SELECT COUNT(*) FROM follows WHERE following_id = ?");
$followersStmt->execute([$viewingId]);
$followersCount = (int)$followersStmt->fetchColumn();

$followingStmt = $pdo->prepare("SELECT COUNT(*) FROM follows WHERE follower_id = ?");
$followingStmt->execute([$viewingId]);
$followingCount = (int)$followingStmt->fetchColumn();

jsonResponse(true, 'Profile loaded.', [
    'user' => [
        'id'         => $u['id'],
        'first_name' => $u['first_name'],
        'last_name'  => $u['last_name'],
        // Only expose contact details for self — never for third-party profile views
        'email'      => ($viewingId === $user['id']) ? $u['email'] : null,
        'mobile'     => ($viewingId === $user['id']) ? $u['mobile'] : null,
    ],
    'profile' => $profile ? [
        'player_code'   => $profile['player_code'],
        'nickname'      => $profile['nickname'],
        'gender'        => $profile['gender'],
        'location_id'   => $profile['location_id'] ? (int)$profile['location_id'] : null,
        'location'      => $profile['location_name'] ?? null,
        'bio'           => $profile['bio'],
        'playing_side'        => $profile['playing_side'],
        'profile_image'       => $profile['profile_image'],
        'profile_image_thumb' => $profile['profile_image_thumb'],
        'age'                 => $age,
        'date_of_birth' => $profile['date_of_birth'],
        'level'         => $profile['level'],
    ] : null,
    'stats' => $stats ? [
        'points'           => (int)($stats['rank_points'] ?? 0),  // competition points for display
        'eligibility_pts'  => (int)($stats['rank_points'] ?? 0) + (int)($stats['current_buffer'] ?? 0),     // total points (buffer + earned) for eligibility
        'matches_played'   => (int)$stats['matches_played'],
        'matches_won'      => (int)$stats['matches_won'],
        'matches_lost'     => (int)$stats['matches_lost'],
        'ranking'          => $currentRanking,
        'ranking_change'   => $rankingChange,
        'highest_ranking'  => $stats['highest_ranking'],
        'points_this_week' => $pointsThisWeek ?? 0,
        'win_rate'         => $winRate,
        'current_buffer'   => (int)($stats['current_buffer'] ?? 0),
    ] : [
        'points' => 0, 'eligibility_pts' => 0, 'matches_played' => 0, 'matches_won' => 0,
        'matches_lost' => 0, 'ranking' => null, 'ranking_change' => null, 'highest_ranking' => null,
        'points_this_week' => 0, 'win_rate' => 0, 'current_buffer' => 0
    ],
    'is_self' => ((int)$viewingId === (int)$user['id']),
    'is_following' => $isFollowing,
    'has_active_story' => $hasActiveStory,
    'followers_count' => $followersCount,
    'following_count' => $followingCount
]);
?>
