<?php
/**
 * POST /api/phone/cancel
 * Phase 5: Cancel a pending phone number request.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = (int)$user['id'];

$match_id       = (int)($data['match_id'] ?? 0);
$target_user_id = (int)($data['target_user_id'] ?? 0);

if ($match_id <= 0 || $target_user_id <= 0) {
    jsonResponse(false, 'match_id and target_user_id are required.', null, 422);
}

// Safely ensure status column allows 'cancelled' string if it was locked to strict ENUM previously
try {
    $pdo->exec("ALTER TABLE phone_requests MODIFY COLUMN status VARCHAR(20) DEFAULT 'pending'");
} catch (Exception $e) { /* ignore */ }

// Update the pending request to cancelled (do not delete so we can track request limit limits)
$stmt = $pdo->prepare("
    SELECT id FROM phone_requests 
    WHERE requester_id = ? AND target_user_id = ? AND match_id = ? AND status = 'pending'
");
$stmt->execute([$uid, $target_user_id, $match_id]);
$req = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$req) {
    jsonResponse(false, 'No pending request found or already processed.', null, 404);
}

$req_id = (int)$req['id'];

$upd = $pdo->prepare("UPDATE phone_requests SET status = 'cancelled' WHERE id = ?");
$upd->execute([$req_id]);

if ($upd->rowCount() > 0) {
    // Phase 6: Remove the notification for the target user (use match_id as reference_id)
    deleteNotification($pdo, $target_user_id, 'phone_requested', $match_id);
    
    jsonResponse(true, 'Phone number request cancelled.');
} else {
    jsonResponse(false, 'Failed to cancel the request.', null, 500);
}
