<?php
/**
 * POST /api/admin/system/backfill_points
 * Admin endpoint to rebuild and backfill player_points_log accurately for all scores.
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
    // 1. Clear existing log table
    $pdo->exec("TRUNCATE TABLE player_points_log");

    $pdo->beginTransaction();

    // 2. Fetch all players
    $players = $pdo->query("SELECT user_id, rank_points, current_buffer, initial_buffer FROM player_stats")->fetchAll(PDO::FETCH_ASSOC);

    $logsCreated = 0;

    foreach ($players as $p) {
        $userId = (int)$p['user_id'];
        $initialBuffer = (int)($p['initial_buffer'] ?: 100);

        // a. Initial setup entry
        logPlayerPointsChange($pdo, $userId, null, 0, 0, 0, $initialBuffer, 'initial_setup', null);
        $logsCreated++;

        // b. Fetch all completed competitive matches for this user
        $stmt = $pdo->prepare("
            SELECT mp.match_id, mp.point_change, m.match_datetime
            FROM match_players mp
            JOIN matches m ON mp.match_id = m.id
            WHERE mp.user_id = ? AND m.status = 'completed' AND m.match_type = 'competition'
            ORDER BY m.match_datetime ASC, m.id ASC
        ");
        $stmt->execute([$userId]);
        $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $runningCore = 0;
        $runningBuffer = $initialBuffer;

        foreach ($matches as $m) {
            $matchId = (int)$m['match_id'];
            $totalMatchChange = (int)($m['point_change'] ?? 0);

            // Fetch approved scores for this match
            $sStmt = $pdo->prepare("SELECT id FROM scores WHERE match_id = ? AND status = 'approved' ORDER BY created_at ASC, id ASC");
            $sStmt->execute([$matchId]);
            $approvedScores = $sStmt->fetchAll(PDO::FETCH_COLUMN);

            $numScores = count($approvedScores);
            if ($numScores === 0) continue;

            // Divide point change across scores proportionally
            $perScoreChange = (int)round($totalMatchChange / $numScores);
            $decayPerScore = (int)round(($initialBuffer * 5 / 100) / $numScores);

            foreach ($approvedScores as $idx => $scoreId) {
                $scoreId = (int)$scoreId;
                $pointsBefore = $runningCore;

                // On last score of match, adjust for rounding difference to match exact total
                $scoreChange = ($idx === $numScores - 1) ? ($totalMatchChange - ($perScoreChange * ($numScores - 1))) : $perScoreChange;
                $pointsAfter = max(0, $pointsBefore + $scoreChange);
                $newBuffer = max(0, $runningBuffer - $decayPerScore);

                logPlayerPointsChange($pdo, $userId, $matchId, $pointsBefore, $pointsAfter, $scoreChange, $newBuffer, 'match_completion', $scoreId);
                $logsCreated++;

                $runningCore = $pointsAfter;
                $runningBuffer = $newBuffer;
            }
        }
    }

    $pdo->commit();
    jsonResponse(true, "Backfill completed successfully. Created {$logsCreated} point log records for " . count($players) . " players.");
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonResponse(false, 'Backfill error: ' . $e->getMessage(), null, 500);
}
?>
