<?php
require_once __DIR__ . '/../backend/core/db.php';
// require_once __DIR__ . '/../backend/helpers/response.php'; // not needed for CLI

$pdo = getDB();

// Test for a specific user ID or just the first user who has notifications
$uid = $pdo->query("SELECT user_id FROM notifications LIMIT 1")->fetchColumn();

if (!$uid) {
    echo "No notifications found in the database for any user.\n";
    exit;
}

echo "Testing notifications for user ID: $uid\n";

try {
    $stmt = $pdo->prepare("
        SELECT 
            MAX(n.id) as id, 
            MAX(n.type) as type, 
            MAX(n.reference_id) as reference_id, 
            MAX(n.sender_id) as sender_id, 
            MAX(n.message_text) as message_text, 
            MIN(n.is_read) as is_read, 
            MAX(n.created_at) as created_at,
            COUNT(*) as count,
            MAX(up.profile_image) AS sender_avatar,
            MAX(u.first_name) AS sender_first_name, 
            MAX(u.last_name) AS sender_last_name, 
            MAX(up.nickname) AS sender_nickname,
            MAX(m.match_code) as match_code
        FROM notifications n
        LEFT JOIN users u ON n.sender_id = u.id
        LEFT JOIN user_profiles up ON n.sender_id = up.user_id
        LEFT JOIN matches m ON n.reference_id = m.id
        WHERE n.user_id = :uid
        GROUP BY (CASE WHEN n.type = 'new_message' THEN CONCAT('chat_', n.reference_id) ELSE n.id END)
        ORDER BY id DESC
        LIMIT 20 OFFSET 0
    ");
    $stmt->bindValue(':uid', $uid, PDO::PARAM_INT);
    $stmt->execute();
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Found " . count($notifications) . " notification groups.\n";
    if (count($notifications) > 0) {
        print_r($notifications[0]);
    } else {
        echo "No notifications for this user.\n";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
