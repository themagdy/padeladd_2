<?php
require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/auth_helper.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json');

$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

// Find the latest active message for this user that they haven't seen yet
// Priority: Specific messages > All users messages
$sql = "
    SELECT m.*
    FROM in_app_messages m
    LEFT JOIN in_app_message_views v ON m.id = v.message_id AND v.user_id = ?
    WHERE m.is_active = 1
      AND v.user_id IS NULL
      AND (m.target_user_id = ? OR m.target_user_id IS NULL)
    ORDER BY m.target_user_id DESC, m.created_at DESC
    LIMIT 1
";

$stmt = $pdo->prepare($sql);
$stmt->execute([$uid, $uid]);
$message = $stmt->fetch();

if (!$message) {
    jsonResponse(true, 'No new messages.', null);
}

// Mark as seen immediately (optional: can be done via another API when user clicks button)
// We'll do it here to ensure it only pops up once per message definition.
$pdo->prepare("INSERT IGNORE INTO in_app_message_views (user_id, message_id) VALUES (?, ?)")
    ->execute([$uid, $message['id']]);

jsonResponse(true, 'New in-app message found.', $message);
