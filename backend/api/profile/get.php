<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

// Logic: If target_id or player_code is provided, fetch THAT user. Otherwise, fetch self.
$targetId = $data['target_id'] ?? null;
$playerCode = isset($data['player_code']) ? strtoupper(trim($data['player_code'])) : null;

if ($playerCode) {
    // Find user by player_code
    $stmtFind = $pdo->prepare("SELECT user_id FROM user_profiles WHERE player_code = ?");
    $stmtFind->execute([$playerCode]);
    $found = $stmtFind->fetch();
    if (!$found) jsonResponse(false, 'Player not found.');
    $viewingId = $found['user_id'];
} elseif ($targetId) {
    $viewingId = $targetId;
} else {
    $viewingId = $user['id'];
}

// Get basic user info
$stmtUser = $pdo->prepare("SELECT id, first_name, last_name, email, mobile FROM users WHERE id = ? AND status = 'active'");
$stmtUser->execute([$viewingId]);
$u = $stmtUser->fetch();
if (!$u) jsonResponse(false, 'User not found.');

// Get profile info
$stmtProf = $pdo->prepare("SELECT * FROM user_profiles WHERE user_id = ?");
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
}

jsonResponse(true, 'Profile loaded.', [
    'user' => [
        'id'         => $u['id'],
        'first_name' => $u['first_name'],
        'last_name'  => $u['last_name'],
        'email'      => $u['email'],
        'mobile'     => $u['mobile'],
    ],
    'profile' => $profile ? [
        'player_code'   => $profile['player_code'],
        'nickname'      => $profile['nickname'],
        'gender'        => $profile['gender'],
        'location'      => $profile['location'],
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
        'points_this_week' => (int)$stats['points_this_week'],
        'win_rate'         => $winRate,
    ] : [
        'points' => 0, 'eligibility_pts' => 0, 'matches_played' => 0, 'matches_won' => 0,
        'matches_lost' => 0, 'ranking' => null, 'ranking_change' => null, 'highest_ranking' => null,
        'points_this_week' => 0, 'win_rate' => 0
    ],
    'is_self' => ($viewingId === $user['id'])
]);
?>
