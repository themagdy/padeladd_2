<?php
/**
 * Script: Backfill Player Points Log
 * Runs chronologically through past registrations and completed matches to construct the points ledger.
 * Run via: php backend/scripts/backfill_points_log.php
 */
require_once __DIR__ . '/../core/db.php';
require_once __DIR__ . '/../helpers/ranking_helper.php';

try {
    $pdo = getDB();
    // 1. Clear any existing log entries first (DDL - implicitly commits in MySQL, do before transaction)
    $pdo->exec("TRUNCATE TABLE player_points_log");

    $pdo->beginTransaction();

    // 2. Fetch all players
    $players = $pdo->query("SELECT user_id, rank_points, current_buffer, initial_buffer FROM player_stats")->fetchAll(PDO::FETCH_ASSOC);

    echo "Backfilling points logs for " . count($players) . " players...\n";

    foreach ($players as $p) {
        $userId = (int)$p['user_id'];
        $initialBuffer = (int)$p['initial_buffer'];

        // a. Log Initial Setup
        logPlayerPointsChange($pdo, $userId, null, 0, 0, 0, $initialBuffer, 'initial_setup');

        // b. Fetch all completed competitive matches chronologically
        $stmt = $pdo->prepare("
            SELECT 
                mp.match_id, 
                mp.point_change,
                m.match_datetime,
                (SELECT s.id FROM scores s WHERE s.match_id = mp.match_id AND s.status = 'approved' LIMIT 1) as score_id
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
            $scoreId = $m['score_id'] ? (int)$m['score_id'] : null;
            $delta = (int)$m['point_change'];

            // 5% buffer decay per match
            $decay = (int) round(($initialBuffer * 5) / 100);
            $newBuffer = max(0, $runningBuffer - $decay);

            $pointsBefore = $runningCore;
            $pointsAfter = max(0, $runningCore + $delta);

            logPlayerPointsChange($pdo, $userId, $matchId, $pointsBefore, $pointsAfter, $delta, $newBuffer, 'match_completion', $scoreId);

            // Update running balances
            $runningCore = $pointsAfter;
            $runningBuffer = $newBuffer;
        }
    }

    $pdo->commit();
    echo "Backfill completed successfully!\n";
} catch (\Throwable $e) {
    echo "Error during backfill: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo $e->getTraceAsString() . "\n";
}
?>
