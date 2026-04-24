<?php
/**
 * POST /api/match/block
 * Partner blocks a requester.
 * After 3 distinct players block the same requester, that requester
 * is barred from team-requesting for 1 month.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$wl_id = (int)($data['waiting_list_id'] ?? 0);
if ($wl_id <= 0) {
    jsonResponse(false, 'waiting_list_id is required.', null, 422);
}

$wlStmt = $pdo->prepare("
    SELECT * FROM waiting_list WHERE id = ? AND partner_id = ? AND request_status = 'pending'
");
$wlStmt->execute([$wl_id, $uid]);
$wl = $wlStmt->fetch(PDO::FETCH_ASSOC);
if (!$wl) {
    jsonResponse(false, 'Request not found or you are not the partner.', null, 404);
}

$requester_id = (int)$wl['requester_id'];
$blocker_id   = $uid;

try {
    $pdo->beginTransaction();

    // Mark request as denied
    $pdo->prepare("UPDATE waiting_list SET request_status = 'denied' WHERE id = ?")->execute([$wl_id]);

    // Upsert block record between THIS blocker and requester
    $blkStmt = $pdo->prepare("
        INSERT INTO blocked_partner_requests (blocker_user_id, blocked_user_id, block_count)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE block_count = block_count + 1, updated_at = NOW()
    ");
    $blkStmt->execute([$blocker_id, $requester_id]);

    // Count how many DISTINCT players have ever blocked the requester (each at least once)
    $countStmt = $pdo->prepare("
        SELECT COUNT(*) AS total_blockers
        FROM blocked_partner_requests
        WHERE blocked_user_id = ?
    ");
    $countStmt->execute([$requester_id]);
    $row = $countStmt->fetch(PDO::FETCH_ASSOC);
    $totalBlockers = (int)$row['total_blockers'];

    // If 3 or more distinct players have blocked the requester, impose 1-month global ban
    if ($totalBlockers >= 3) {
        $blockedUntil = date('Y-m-d H:i:s', strtotime('+1 month'));
        // We store the global ban on a sentinel row where blocker = blocked (self-block sentinel)
        // Actually, we add a separate column on the requester's own blocked record.
        // Simplest approach: store a "global" blocked_until in a self-referencing row.
        $pdo->prepare("
            INSERT INTO blocked_partner_requests (blocker_user_id, blocked_user_id, block_count, blocked_until)
            VALUES (?, ?, 1, ?)
            ON DUPLICATE KEY UPDATE blocked_until = VALUES(blocked_until), updated_at = NOW()
        ")->execute([$requester_id, $requester_id, $blockedUntil]);
    }

    $pdo->commit();

    // Phase 6: Notify requester that they were blocked
    $blockerName = getDisplayName($user);
    createNotification($pdo, $requester_id, 'partner_blocked', (int)$wl['match_id'], "{$blockerName} blocked your request", $uid);

    $message = $totalBlockers >= 3
        ? 'Request blocked. This user has been suspended from team requests for 1 month.'
        : 'Request blocked.';

    jsonResponse(true, $message, ['total_blockers' => $totalBlockers]);

} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(false, 'Block failed: ' . $e->getMessage(), null, 500);
}
