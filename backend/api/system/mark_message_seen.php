<?php
require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/auth_helper.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json');

$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

$message_id = (int)($data['message_id'] ?? 0);

if ($message_id <= 0) {
    jsonResponse(false, 'Invalid Message ID');
}

// Mark as seen
$pdo->prepare("INSERT IGNORE INTO in_app_message_views (user_id, message_id) VALUES (?, ?)")
    ->execute([$uid, $message_id]);

jsonResponse(true, 'Message marked as seen', ['message_id' => $message_id]);
