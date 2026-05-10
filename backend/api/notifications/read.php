<?php
/**
 * POST /api/notifications/read
 * Phase 6: Mark notifications as read.
 * Accepts: { all: true } OR { ids: [1, 2, 3] }
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = (int)$user['id'];

$markAll = !empty($data['all']);
$ids     = isset($data['ids']) && is_array($data['ids']) ? array_map('intval', $data['ids']) : [];

if ($markAll) {
    $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0");
    $stmt->execute([$uid]);
} elseif (!empty($ids)) {
    // Phase 6 (Group Fix): Mark the specific IDs as read
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN ($placeholders) AND is_read = 0");
    $stmt->execute(array_merge([$uid], $ids));

    // Also mark all other messages in the same chats as read (to fix the grouped counter issue)
    $stmtGroups = $pdo->prepare("
        UPDATE notifications n1
        JOIN notifications n2 ON n1.reference_id = n2.reference_id AND n1.type = n2.type
        SET n1.is_read = 1
        WHERE n2.id IN ($placeholders) 
          AND n2.type = 'new_message'
          AND n1.user_id = ?
          AND n1.is_read = 0
    ");
    $stmtGroups->execute(array_merge($ids, [$uid]));
} else {
    jsonResponse(false, 'Provide either all:true or ids:[...]', null, 422);
}

// Return new unread count
$countStmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0");
$countStmt->execute([$uid]);
$unreadCount = (int)$countStmt->fetchColumn();

jsonResponse(true, 'Marked as read.', ['unread_count' => $unreadCount]);
