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
$levelKey    = $level;
require_once __DIR__ . '/../../helpers/ranking_helper.php';

// Get current points before action
$ptsBeforeQuery = $pdo->prepare("SELECT rank_points FROM player_stats WHERE user_id = ?");
$ptsBeforeQuery->execute([$user['id']]);
$rankPtsBefore = $ptsBeforeQuery->fetchColumn();
$points_before = ($rankPtsBefore !== false && $rankPtsBefore !== null) ? (int)$rankPtsBefore : 0;

$calcPoints  = isset($data['calculated_points']) ? (int)$data['calculated_points'] : null;
$startPoints = ($calcPoints !== null && $calcPoints >= 0) ? $calcPoints : ($levelPoints[$levelKey] ?? 100);

// Check if player has ever completed a competition match
$compPlayed = $pdo->prepare("
    SELECT COUNT(*) FROM match_players mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = ? AND m.match_type = 'competition' AND m.status = 'completed'
");
$compPlayed->execute([$user['id']]);
$hasPlayed = (int)$compPlayed->fetchColumn() > 0;

if (!$hasPlayed) {
    // No competition history — safe to set/reset starting eligibility points; always init rank_points = 0
    $pdo->prepare("
        INSERT INTO player_stats (user_id, current_buffer, initial_buffer, buffer_matches_left, rank_points)
        VALUES (?, ?, ?, 20, 0)
        ON DUPLICATE KEY UPDATE 
            current_buffer = VALUES(current_buffer),
            initial_buffer = VALUES(initial_buffer),
            buffer_matches_left = VALUES(buffer_matches_left),
            rank_points = IF(rank_points = 0, 0, rank_points)
    ")->execute([$user['id'], $startPoints, $startPoints]);
} else {
    // Has played — just ensure a stats row exists, don't overwrite earned points
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, current_buffer, initial_buffer, buffer_matches_left, rank_points) VALUES (?, ?, ?, 20, 0)")
        ->execute([$user['id'], $startPoints, $startPoints]);
}

$ptsAfterQuery = $pdo->prepare("SELECT rank_points, current_buffer FROM player_stats WHERE user_id = ?");
$ptsAfterQuery->execute([$user['id']]);
$stats = $ptsAfterQuery->fetch(PDO::FETCH_ASSOC);
$points_after = (int)($stats['rank_points'] ?? 0);
$buffer_after = (int)($stats['current_buffer'] ?? 0);

// Only log initial setup if a log entry for it doesn't exist yet
$checkLog = $pdo->prepare("SELECT COUNT(*) FROM player_points_log WHERE user_id = ? AND reason = 'initial_setup'");
$checkLog->execute([$user['id']]);
$hasLog = (int)$checkLog->fetchColumn() > 0;

if (!$hasLog) {
    logPlayerPointsChange($pdo, $user['id'], null, 0, $points_after, 0, $buffer_after, 'initial_setup');
}

$stmtStep = $pdo->prepare("UPDATE users SET onboarding_step = 'completed' WHERE id = ?");
$stmtStep->execute([$user['id']]);

jsonResponse(true, 'Level saved successfully.');
