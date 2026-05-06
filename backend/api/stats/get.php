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
          AND m.match_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ");
    $rollingStmt->execute([$user['id']]);
    $pointsThisWeek = (int)$rollingStmt->fetchColumn();
}

jsonResponse(true, 'Stats loaded.', [
    'points'           => $stats ? (int)($stats['rank_points'] ?? 0) : 0, // competition points (display/ranking)
    'eligibility_pts'  => $stats ? ((int)($stats['rank_points'] ?? 0) + (int)($stats['current_buffer'] ?? 0)) : 100,           // total points for eligibility logic
    'matches_played'   => $stats ? (int)$stats['matches_played'] : 0,
    'matches_won'      => $stats ? (int)$stats['matches_won'] : 0,
    'matches_lost'     => $stats ? (int)$stats['matches_lost'] : 0,
    'ranking'          => $stats ? $stats['ranking'] : null,
    'highest_ranking'  => $stats ? $stats['highest_ranking'] : null,
    'points_this_week' => $pointsThisWeek,
    'win_rate'         => $winRate,
]);
?>
