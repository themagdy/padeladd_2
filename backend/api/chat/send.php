<?php
/**
 * POST /api/chat/send
 * Phase 5: Send a message to a match chat.
 * Only players confirmed in the match or on the waiting list can send messages.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = (int)$user['id'];

$match_id     = (int)($data['match_id'] ?? 0);
$message_text = trim($data['message_text'] ?? '');

if ($match_id <= 0) {
    jsonResponse(false, 'match_id is required.', null, 422);
}
if ($message_text === '') {
    jsonResponse(false, 'Message cannot be empty.', null, 422);
}
if (mb_strlen($message_text) > 500) {
    jsonResponse(false, 'Message is too long (max 500 characters).', null, 422);
}

// Verify match exists
$mStmt = $pdo->prepare("SELECT id, status FROM matches WHERE id = ?");
$mStmt->execute([$match_id]);
$match = $mStmt->fetch(PDO::FETCH_ASSOC);
if (!$match) {
    jsonResponse(false, 'Match not found.', null, 404);
}
if ($match['status'] === 'cancelled') {
    jsonResponse(false, 'Cannot send messages to a cancelled match.', null, 403);
}

// Check access: must be a confirmed player or in the waiting list
$accessStmt = $pdo->prepare("
    SELECT 1 FROM match_players WHERE match_id = ? AND user_id = ? AND status = 'confirmed'
    UNION
    SELECT 1 FROM waiting_list WHERE match_id = ? AND (requester_id = ? OR partner_id = ?) AND request_status IN ('pending', 'approved')
    LIMIT 1
");
$accessStmt->execute([$match_id, $uid, $match_id, $uid, $uid]);
if (!$accessStmt->fetch()) {
    jsonResponse(false, 'You are not a member of this match.', null, 403);
}

// Insert message
$ins = $pdo->prepare("INSERT INTO chat_messages (match_id, user_id, message_text) VALUES (?, ?, ?)");
$ins->execute([$match_id, $uid, $message_text]);
$msg_id = (int)$pdo->lastInsertId();

// Phase 6: Notify offline match members about new message
$senderName  = getDisplayName($user);
$preview     = mb_substr($message_text, 0, 60) . (mb_strlen($message_text) > 60 ? '…' : '');
$notifMsg    = "{$senderName}: {$preview}";

// Fetch all match members (confirmed players + approved waiting list)
$membersStmt = $pdo->prepare("
    SELECT user_id FROM match_players WHERE match_id = ? AND status = 'confirmed'
    UNION
    SELECT requester_id AS user_id FROM waiting_list WHERE match_id = ? AND request_status IN ('pending','approved')
    UNION
    SELECT partner_id AS user_id FROM waiting_list WHERE match_id = ? AND partner_id IS NOT NULL AND request_status IN ('pending','approved')
");
$membersStmt->execute([$match_id, $match_id, $match_id]);
$memberIds = array_column($membersStmt->fetchAll(PDO::FETCH_ASSOC), 'user_id');

// Fetch users currently online in this chat (last seen within 15s)
$onlineStmt = $pdo->prepare("
    SELECT user_id FROM chat_presence
    WHERE match_id = ? AND last_seen >= NOW() - INTERVAL 15 SECOND
");
$onlineStmt->execute([$match_id]);
$onlineIds = array_column($onlineStmt->fetchAll(PDO::FETCH_ASSOC), 'user_id');
$onlineSet = array_flip(array_map('intval', $onlineIds));

foreach ($memberIds as $memberId) {
    $memberId = (int)$memberId;
    if ($memberId === $uid) continue;           // Don't notify sender
    if (isset($onlineSet[$memberId])) continue; // Don't notify if online in chat
    createNotification($pdo, $memberId, 'new_message', $match_id, $notifMsg, $uid);
}

jsonResponse(true, 'Message sent.', ['message_id' => $msg_id]);
