<?php
/**
 * POST /api/chat/presence-clear
 * Phase 6: Explicitly clear chat presence for a user in a match.
 * Called when chat is closed to re-enable notifications immediately.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = (int)$user['id'];

$match_id = (int)($data['match_id'] ?? 0);

if ($match_id > 0) {
    $stmt = $pdo->prepare("DELETE FROM chat_presence WHERE user_id = ? AND match_id = ?");
    $stmt->execute([$uid, $match_id]);
}

jsonResponse(true, 'Presence cleared.', []);
?>
