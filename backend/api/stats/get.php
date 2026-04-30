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

jsonResponse(true, 'Stats loaded.', [
    'points'           => $stats ? (int)($stats['rank_points'] ?? 0) : 0, // competition points (display/ranking)
    'eligibility_pts'  => $stats ? (int)$stats['points'] : 100,           // level-based points (eligibility only)
    'matches_played'   => $stats ? (int)$stats['matches_played'] : 0,
    'matches_won'      => $stats ? (int)$stats['matches_won'] : 0,
    'matches_lost'     => $stats ? (int)$stats['matches_lost'] : 0,
    'ranking'          => $stats ? $stats['ranking'] : null,
    'highest_ranking'  => $stats ? $stats['highest_ranking'] : null,
    'points_this_week' => $stats ? (int)$stats['points_this_week'] : 0,
    'win_rate'         => $winRate,
]);
?>
