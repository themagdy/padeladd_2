<?php
/**
 * POST /api/match/report
 * Reports an issue with a match or player.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

$match_id = (int)($data['match_id'] ?? 0);
$target_user_id = (int)($data['target_user_id'] ?? 0);
$reason = trim($data['reason'] ?? '');

if ($match_id <= 0) {
    jsonResponse(false, 'Match ID is required.', null, 422);
}

if (empty($reason)) {
    jsonResponse(false, 'Report reason is required.', null, 422);
}

// 1. Fetch match
$stmt = $pdo->prepare("SELECT * FROM matches WHERE id = ?");
$stmt->execute([$match_id]);
$match = $stmt->fetch();

if (!$match) {
    jsonResponse(false, 'Match not found.', null, 404);
}

// 2. Check if user is a participant
$playerStmt = $pdo->prepare("SELECT * FROM match_players WHERE match_id = ? AND user_id = ?");
$playerStmt->execute([$match_id, $uid]);
if (!$playerStmt->fetch()) {
    jsonResponse(false, 'Only match participants can report issues.', null, 403);
}

// 3. Save report
try {
    $ins = $pdo->prepare("INSERT INTO match_reports (match_id, reported_by_user_id, target_user_id, reason_text) VALUES (?, ?, ?, ?)");
    $ins->execute([$match_id, $uid, $target_user_id ?: null, $reason]);

    jsonResponse(true, 'Report submitted successfully. Our team will review it.');
} catch (Exception $e) {
    jsonResponse(false, 'Failed to submit report: ' . $e->getMessage(), null, 500);
}
