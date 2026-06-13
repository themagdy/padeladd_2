<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

require_once __DIR__ . '/../../../helpers/notification_helper.php';

header('Content-Type: application/json');
validateAdmin();

$input = json_decode(file_get_contents('php://input'), true);
$chatId = $input['chat_id'] ?? null;
$hide = isset($input['hide']) ? (int)$input['hide'] : 0;

if (!$chatId) {
    jsonResponse(false, 'Chat ID required.', null, 400);
}

$pdo = getDB();

try {
    // If hiding the message, delete any associated new_message notifications
    if ($hide) {
        $msgStmt = $pdo->prepare("SELECT match_id, user_id, message_text FROM chat_messages WHERE id = ?");
        $msgStmt->execute([$chatId]);
        $msg = $msgStmt->fetch(PDO::FETCH_ASSOC);

        if ($msg) {
            $senderId = (int)$msg['user_id'];
            if ($senderId === ADMIN_SYSTEM_USER_ID) {
                $senderName = 'Padeladd Admin';
            } else {
                $userStmt = $pdo->prepare("SELECT u.*, up.nickname FROM users u LEFT JOIN user_profiles up ON u.id = up.user_id WHERE u.id = ?");
                $userStmt->execute([$senderId]);
                $senderUser = $userStmt->fetch(PDO::FETCH_ASSOC);
                $senderName = $senderUser ? getDisplayName($senderUser) : '';
            }

            if ($senderName !== '') {
                $preview = mb_substr($msg['message_text'], 0, 60) . (mb_strlen($msg['message_text']) > 60 ? '…' : '');
                $notifMsg = "{$senderName}: {$preview}";

                $delNotif = $pdo->prepare("DELETE FROM notifications WHERE type = 'new_message' AND reference_id = ? AND sender_id = ? AND message_text = ?");
                $delNotif->execute([(int)$msg['match_id'], $senderId, $notifMsg]);
            }
        }
    }

    $stmt = $pdo->prepare("UPDATE chat_messages SET is_hidden = ? WHERE id = ?");
    $stmt->execute([$hide, $chatId]);
    
    jsonResponse(true, $hide ? 'Message hidden from public chat.' : 'Message restored to public chat.');
} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
}
