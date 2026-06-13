<?php
/**
 * POST /api/admin/matches/send_admin_msg
 * Admin-only: Send a message to a match chat room with the system admin identity.
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/notification_helper.php';

header('Content-Type: application/json');
validateAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Method not allowed.', null, 405);
}

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true) ?: [];

$match_id = (int)($data['match_id'] ?? 0);
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

$pdo = getDB();

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

// Insert message with Admin System ID
$ins = $pdo->prepare("INSERT INTO chat_messages (match_id, user_id, message_text) VALUES (?, ?, ?)");
$ins->execute([$match_id, ADMIN_SYSTEM_USER_ID, $message_text]);
$msg_id = (int)$pdo->lastInsertId();

// Phase 6: Notify offline match members about new message
$senderName = 'Padeladd Admin';
$preview = mb_substr($message_text, 0, 60) . (mb_strlen($message_text) > 60 ? '…' : '');
$notifMsg = "{$senderName}: {$preview}";

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
    if (isset($onlineSet[$memberId])) continue; // Don't notify if online in chat
    createNotification($pdo, $memberId, 'new_message', $match_id, $notifMsg, ADMIN_SYSTEM_USER_ID);
}

jsonResponse(true, 'Admin message sent.', ['message_id' => $msg_id]);
