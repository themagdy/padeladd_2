<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

$level = trim($data['level'] ?? '');

if (empty($level)) {
    jsonResponse(false, 'Level is required.');
}

$update = $pdo->prepare("UPDATE user_profiles SET level = ? WHERE user_id = ?");
$update->execute([$level, $user['id']]);

// Ensure they appear in the leaderboard immediately with base points
$pdo->prepare("INSERT IGNORE INTO player_stats (user_id, points) VALUES (?, 50)")->execute([$user['id']]);

jsonResponse(true, 'Level saved successfully.');
?>
