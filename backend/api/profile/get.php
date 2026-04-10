<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

// Get basic user info
$stmtUser = $pdo->prepare("SELECT id, first_name, last_name, email, mobile FROM users WHERE id = ?");
$stmtUser->execute([$user['id']]);
$u = $stmtUser->fetch();

// Get profile info
$stmtProf = $pdo->prepare("SELECT * FROM user_profiles WHERE user_id = ?");
$stmtProf->execute([$user['id']]);
$profile = $stmtProf->fetch();

// Get stats
$stmtStats = $pdo->prepare("SELECT * FROM player_stats WHERE user_id = ?");
$stmtStats->execute([$user['id']]);
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
        'playing_hand'  => $profile['playing_hand'],
        'profile_image' => $profile['profile_image'],
        'age'           => $age,
    ] : null,
    'stats' => $stats ? [
        'points'           => (int)$stats['points'],
        'matches_played'   => (int)$stats['matches_played'],
        'matches_won'      => (int)$stats['matches_won'],
        'matches_lost'     => (int)$stats['matches_lost'],
        'ranking'          => $stats['ranking'],
        'highest_ranking'  => $stats['highest_ranking'],
        'points_this_week' => (int)$stats['points_this_week'],
        'win_rate'         => $winRate,
    ] : [
        'points' => 0, 'matches_played' => 0, 'matches_won' => 0,
        'matches_lost' => 0, 'ranking' => null, 'highest_ranking' => null,
        'points_this_week' => 0, 'win_rate' => 0
    ],
]);
?>
