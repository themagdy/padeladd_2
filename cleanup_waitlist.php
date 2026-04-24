<?php
/**
 * One-time utility script to clean up 'zombie' waiting list entries.
 * Finds any player who is already in match_players but still has an active waiting_list entry for the same match.
 */
require_once __DIR__ . '/backend/core/db.php';

$pdo = getDB();

try {
    $pdo->beginTransaction();

    // Find all active waiting list entries (pending or approved) 
    // where either the requester or the partner is already in match_players for that match.
    $stmt = $pdo->query("
        SELECT wl.id, wl.match_id, wl.requester_id, wl.partner_id
        FROM waiting_list wl
        WHERE wl.request_status IN ('pending', 'approved')
    ");
    $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $fixedCount = 0;
    foreach ($entries as $e) {
        // Check if requester is in the match
        $check = $pdo->prepare("SELECT id FROM match_players WHERE match_id = ? AND user_id = ?");
        $check->execute([$e['match_id'], $e['requester_id']]);
        $reqIn = $check->fetch();

        // Check if partner is in the match (if exists)
        $parIn = false;
        if ($e['partner_id']) {
            $check->execute([$e['match_id'], $e['partner_id']]);
            $parIn = $check->fetch();
        }

        if ($reqIn || $parIn) {
            // Player is already in the match! Mark waitlist as joined.
            $pdo->prepare("UPDATE waiting_list SET request_status = 'joined' WHERE id = ?")->execute([$e['id']]);
            $fixedCount++;
        }
    }

    $pdo->commit();
    echo "Cleanup complete! Fixed $fixedCount zombie entries.\n";

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo "Cleanup failed: " . $e->getMessage() . "\n";
}
