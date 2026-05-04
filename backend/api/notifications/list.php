<?php
/**
 * POST /api/notifications/list
 * Phase 6: Get current user's notifications (newest first).
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = (int)$user['id'];

require_once __DIR__ . '/../../helpers/notification_helper.php';

// Ensure $data is an array (to avoid Fatal Error on null in PHP 8+)
$data = $data ?? [];
$limit  = (int)($data['limit']  ?? 20);
$offset = (int)($data['offset'] ?? 0);

// Fetch count first or just use a standard limit check
$stmt = $pdo->prepare("
    SELECT n.id, n.type, n.reference_id, n.sender_id, n.message_text, n.is_read, n.created_at,
           up.profile_image AS sender_avatar,
           u.first_name AS sender_first_name, u.last_name AS sender_last_name, up.nickname AS sender_nickname,
           m.match_code
    FROM notifications n
    LEFT JOIN users u ON n.sender_id = u.id
    LEFT JOIN user_profiles up ON n.sender_id = up.user_id
    LEFT JOIN matches m ON n.reference_id = m.id AND n.type IN ('match_joined', 'team_invite', 'partner_confirmed', 'player_withdrawn', 'partner_denied', 'score_submitted', 'score_confirmed', 'score_disputed', 'score_approved', 'score_reminder', 'match_cancelled', 'new_message', 'phone_requested', 'phone_approved', 'phone_denied', 'partner_blocked', 'match_started', 'availability_alert')
    WHERE n.user_id = :uid
    ORDER BY n.created_at DESC
    LIMIT :limit OFFSET :offset
");
$stmt->bindValue(':uid', $uid, PDO::PARAM_INT);
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Peak ahead to see if there's more
$checkStmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ?");
$checkStmt->execute([$uid]);
$total = (int)$checkStmt->fetchColumn();
$has_more = ($offset + count($notifications)) < $total;

$unreadCount = 0;
foreach ($notifications as &$n) {
    $n['id']           = (int)$n['id'];
    $n['reference_id'] = $n['reference_id'] !== null ? (int)$n['reference_id'] : null;
    $n['sender_id']    = $n['sender_id'] !== null ? (int)$n['sender_id'] : null;
    $n['is_read']      = (bool)$n['is_read'];
    
    // Ensure strings for JS truthiness
    $n['sender_avatar']     = !empty($n['sender_avatar']) ? (string)$n['sender_avatar'] : null;
    $n['sender_nickname']   = !empty($n['sender_nickname']) ? (string)$n['sender_nickname'] : null;
    $n['sender_first_name'] = !empty($n['sender_first_name']) ? (string)$n['sender_first_name'] : null;
    $n['sender_last_name']  = !empty($n['sender_last_name']) ? (string)$n['sender_last_name'] : null;

    if (!$n['is_read']) $unreadCount++;
}
unset($n);

// Global unread count for badge
$globalUnreadStmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0");
$globalUnreadStmt->execute([$uid]);
$globalUnreadCount = (int)$globalUnreadStmt->fetchColumn();

jsonResponse(true, 'Notifications loaded.', [
    'notifications' => $notifications,
    'unread_count'  => $globalUnreadCount,
    'has_more'      => $has_more,
    'total_count'   => $total
]);
