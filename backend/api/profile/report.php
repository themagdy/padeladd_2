<?php
/**
 * POST /api/profile/report
 * Reports an issue with a player profile.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

$target_user_id = (int)($data['target_user_id'] ?? 0);
$reason = trim($data['reason'] ?? '');

if ($target_user_id <= 0) {
    jsonResponse(false, 'Target user ID is required.', null, 422);
}

if ($target_user_id === $uid) {
    jsonResponse(false, 'You cannot report yourself.', null, 422);
}

if (empty($reason)) {
    jsonResponse(false, 'Report reason is required.', null, 422);
}

// Check if user exists
$stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
$stmt->execute([$target_user_id]);
if (!$stmt->fetch()) {
    jsonResponse(false, 'Target user not found.', null, 404);
}

try {
    $ins = $pdo->prepare("INSERT INTO profile_reports (reported_by_user_id, target_user_id, reason_text) VALUES (?, ?, ?)");
    $ins->execute([$uid, $target_user_id, $reason]);

    jsonResponse(true, 'Report submitted successfully. Our team will review it.');
} catch (Exception $e) {
    jsonResponse(false, 'Failed to submit report: ' . $e->getMessage(), null, 500);
}
