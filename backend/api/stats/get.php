<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

$stmt = $pdo->prepare("SELECT * FROM player_stats WHERE user_id = ?");
$stmt->execute([$user['id']]);
$stats = $stmt->fetch();

$winRate = 0;
if ($stats && $stats['matches_played'] > 0) {
    $winRate = intval(($stats['matches_won'] * 100) / $stats['matches_played']);
}

// Calculate rolling 7-day points
$pointsThisWeek = 0;
if ($stats) {
    $rollingStmt = $pdo->prepare("
        SELECT COALESCE(SUM(mp.point_change), 0)
        FROM match_players mp
        JOIN matches m ON mp.match_id = m.id
        WHERE mp.user_id = ? 
          AND m.status = 'completed'
          AND m.match_type = 'competition'
          AND m.match_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ");
    $rollingStmt->execute([$user['id']]);
    $pointsThisWeek = (int)$rollingStmt->fetchColumn();
}

$totalPlayed = 0;
$compPlayed = 0;
$friendlyPlayed = 0;
if ($stats) {
    $countStmt = $pdo->prepare("
        SELECT m.match_type, COUNT(DISTINCT s.id) AS cnt
        FROM scores s
        JOIN match_players mp ON s.match_id = mp.match_id
        JOIN matches m ON s.match_id = m.id
        WHERE mp.user_id = ? AND s.status = 'approved' AND m.status = 'completed'
        GROUP BY m.match_type
    ");
    $countStmt->execute([$user['id']]);
    $counts = $countStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($counts as $c) {
        if ($c['match_type'] === 'competition') {
            $compPlayed = (int)$c['cnt'];
        } elseif ($c['match_type'] === 'friendly') {
            $friendlyPlayed = (int)$c['cnt'];
        }
    }
    $totalPlayed = $compPlayed + $friendlyPlayed;
}

// Global min & max points for friendly match eligibility sliders
$boundsStmt = $pdo->query("SELECT COALESCE(MIN(rank_points), 0) AS min_pts, COALESCE(MAX(rank_points), 1000) AS max_pts FROM player_stats");
$boundsRow = $boundsStmt->fetch(PDO::FETCH_ASSOC);
$minPlayerPts = (int)($boundsRow['min_pts'] ?? 0);
$maxPlayerPts = max(1000, (int)($boundsRow['max_pts'] ?? 1000));

jsonResponse(true, 'Stats loaded.', [
    'points'           => $stats ? (int)($stats['rank_points'] ?? 0) : 0, // competition points (display/ranking)
    'eligibility_pts'  => $stats ? ((int)($stats['rank_points'] ?? 0) + (int)($stats['current_buffer'] ?? 0)) : 100,           // total points for eligibility logic
    'matches_played'   => $totalPlayed,
    'comp_played'      => $compPlayed,
    'friendly_played'  => $friendlyPlayed,
    'matches_won'      => $stats ? (int)$stats['matches_won'] : 0,
    'matches_lost'     => $stats ? (int)$stats['matches_lost'] : 0,
    'ranking'          => $stats ? $stats['ranking'] : null,
    'highest_ranking'  => $stats ? $stats['highest_ranking'] : null,
    'points_this_week' => $pointsThisWeek,
    'win_rate'         => $winRate,
    'min_player_pts'   => $minPlayerPts,
    'max_player_pts'   => $maxPlayerPts,
]);
?>
