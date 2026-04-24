<?php
/**
 * POST /api/phone/respond
 * Phase 5: Approve or deny an incoming phone number request.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = (int)$user['id'];

$request_id = (int)($data['request_id'] ?? 0);
$action     = trim($data['action'] ?? '');

if ($request_id <= 0) {
    jsonResponse(false, 'request_id is required.', null, 422);
}
if (!in_array($action, ['approve', 'deny'])) {
    jsonResponse(false, 'action must be "approve" or "deny".', null, 422);
}

// Fetch request — must be targeting the current user
$stmt = $pdo->prepare("SELECT * FROM phone_requests WHERE id = ? AND target_user_id = ?");
$stmt->execute([$request_id, $uid]);
$req = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$req) {
    jsonResponse(false, 'Request not found or you are not authorized.', null, 404);
}
if ($req['status'] !== 'pending') {
    jsonResponse(false, 'This request has already been responded to.', null, 409);
}

$newStatus = $action === 'approve' ? 'approved' : 'denied';

if ($newStatus === 'denied') {
    $upd = $pdo->prepare("UPDATE phone_requests SET status = ?, deny_count = COALESCE(deny_count, 0) + 1, updated_at = NOW() WHERE id = ?");
} else {
    $upd = $pdo->prepare("UPDATE phone_requests SET status = ?, updated_at = NOW() WHERE id = ?");
}

$upd->execute([$newStatus, $request_id]);
$responseData = ['status' => $newStatus];

// If approved, return the current user's (target's) phone number to the requester
if ($newStatus === 'approved') {
    $phoneStmt = $pdo->prepare("SELECT mobile FROM users WHERE id = ?");
    $phoneStmt->execute([$uid]);
    $phoneRow = $phoneStmt->fetch(PDO::FETCH_ASSOC);
    $responseData['phone'] = $phoneRow['mobile'] ?? null;

    // Phase 6: Notify requester that their phone request was approved
    $approverName = getDisplayName($user);
    createNotification($pdo, (int)$req['requester_id'], 'phone_approved', (int)$req['match_id'], "{$approverName} shared their phone number with you", $uid);
} else {
    // Phase 6: Notify requester that their phone request was denied
    $denierName = getDisplayName($user);
    createNotification($pdo, (int)$req['requester_id'], 'phone_denied', (int)$req['match_id'], "{$denierName} denied your phone request", $uid);
}


jsonResponse(true, $newStatus === 'approved' ? 'Phone number shared.' : 'Request denied.', $responseData);
