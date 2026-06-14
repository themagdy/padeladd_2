<?php
require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/auth_helper.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

// Find the latest active message for this user that they haven't seen yet
// Priority: Specific messages > All users messages
$sql = "
    SELECT m.*
    FROM in_app_messages m
    JOIN users u ON u.id = ?
    WHERE m.is_active = 1
      AND NOT EXISTS (
          SELECT 1 FROM in_app_message_views v 
          WHERE v.message_id = m.id AND v.user_id = ?
      )
      AND (m.target_user_id = ? OR m.target_user_id IS NULL)
      AND (
          m.target_build_refs IS NULL 
          OR m.target_build_refs = '' 
          OR m.target_build_refs = '[]'
          OR JSON_CONTAINS(m.target_build_refs, JSON_QUOTE(u.last_build_ref))
      )
    ORDER BY m.target_user_id DESC, m.created_at DESC
    LIMIT 1
";

$stmt = $pdo->prepare($sql);
$stmt->execute([$uid, $uid, $uid]);
$message = $stmt->fetch();

if (!$message) {
    jsonResponse(true, 'No new messages.', null);
}

// Decode any accidentally escaped HTML from the rich text editor
if (isset($message['body'])) {
    $message['body'] = html_entity_decode($message['body'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

// No longer marking as seen here. We mark as seen only when they click the button in the UI.
jsonResponse(true, 'New in-app message found.', $message);
