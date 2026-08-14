<?php
/**
 * POST /api/admin/system/backfill_points
 * Admin endpoint to rebuild and backfill player_points_log using live ranking calculation engine.
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/ranking_helper.php';

header('Content-Type: application/json');
validateAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Method not allowed.', null, 405);
}

$pdo = getDB();

try {
    // 1. Reset player_points_log and match_players point changes
    $pdo->exec("TRUNCATE TABLE player_points_log");
    $pdo->exec("UPDATE match_players SET point_change = NULL");

    // 2. Reset player_stats to starting values based on level
    $stats = $pdo->query("
        SELECT ps.user_id, up.level_key 
        FROM player_stats ps
        LEFT JOIN user_profiles up ON ps.user_id = up.user_id
    ")->fetchAll(PDO::FETCH_ASSOC);

    foreach ($stats as $st) {
        $uId = (int)$st['user_id'];
        $startingPoints = getStartingPoints($st['level_key'] ?? 'beginner');
        $pdo->prepare("
            UPDATE player_stats 
            SET rank_points = 0, initial_buffer = ?, current_buffer = ?, buffer_matches_left = 20,
                matches_played = 0, matches_won = 0, matches_lost = 0, win_rate = 0, streak = 0
            WHERE user_id = ?
        ")->execute([$startingPoints, $startingPoints, $uId]);

        logPlayerPointsChange($pdo, $uId, null, 0, 0, 0, $startingPoints, 'initial_setup', null);
    }

    // 3. Fetch all completed competition matches ordered chronologically
    $matches = $pdo->query("
        SELECT id FROM matches 
        WHERE status = 'completed' AND match_type = 'competition'
        ORDER BY match_datetime ASC, id ASC
    ")->fetchAll(PDO::FETCH_COLUMN);

    $processedScores = 0;

    foreach ($matches as $mId) {
        $mId = (int)$mId;
        // Fetch approved scores for this match
        $scores = $pdo->prepare("SELECT id FROM scores WHERE match_id = ? AND status = 'approved' ORDER BY created_at ASC, id ASC");
        $scores->execute([$mId]);
        $scoreIds = $scores->fetchAll(PDO::FETCH_COLUMN);

        foreach ($scoreIds as $sId) {
            $sId = (int)$sId;
            calculateRankingUpdates($pdo, $mId, $sId);
            $processedScores++;
        }
    }

    jsonResponse(true, "Live ranking engine backfill complete! Recalculated {$processedScores} approved scores across " . count($matches) . " competition matches.");
} catch (\Throwable $e) {
    jsonResponse(false, 'Backfill error: ' . $e->getMessage(), null, 500);
}
?>
