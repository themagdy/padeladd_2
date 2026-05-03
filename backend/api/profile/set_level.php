<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

$level = trim($data['level'] ?? '');

if (empty($level)) {
    jsonResponse(false, 'Level is required.');
}

$update = $pdo->prepare("UPDATE user_profiles SET level = ? WHERE user_id = ?");
$update->execute([$level, $user['id']]);

// Assign starting points based on level (only if they haven't played a competition match yet)
$levelPoints = [
    'beginner'                => 100,
    'initiation_intermediate' => 250,
    'intermediate'            => 400,
    'intermediate_high'       => 550,
    'advanced'                => 700,
    'competition'             => 850,
    'professional'            => 1000,
];
$levelKey    = strtolower(str_replace(' ', '_', $level));
$startPoints = $levelPoints[$levelKey] ?? 100;

// Check if player has ever completed a competition match
$compPlayed = $pdo->prepare("
    SELECT COUNT(*) FROM match_players mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = ? AND m.match_type = 'competition' AND m.status = 'completed'
");
$compPlayed->execute([$user['id']]);
$hasPlayed = (int)$compPlayed->fetchColumn() > 0;

if (!$hasPlayed) {
    // No competition history — safe to set/reset starting eligibility points; always init rank_points = 50
    $pdo->prepare("
        INSERT INTO player_stats (user_id, points, rank_points, initial_buffer, buffer_matches_left)
        VALUES (?, ?, 50, ?, 20)
        ON DUPLICATE KEY UPDATE 
            points = VALUES(points), 
            rank_points = IF(rank_points = 0, 50, rank_points),
            initial_buffer = VALUES(initial_buffer),
            buffer_matches_left = 20
    ")->execute([$user['id'], $startPoints, $startPoints]);
} else {
    // Has played — just ensure a stats row exists, don't overwrite earned points
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, points, rank_points, initial_buffer, buffer_matches_left) VALUES (?, ?, 50, ?, 0)")
        ->execute([$user['id'], $startPoints, $startPoints]);
}

jsonResponse(true, 'Level saved successfully.');
