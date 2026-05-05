<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../backend/core/db.php';
require_once __DIR__ . '/../backend/helpers/notification_helper.php';

$pdo = getDB();

// Mock data
$uid = 1; // Change to a valid user ID if needed
$limit = 20;
$offset = 0;

try {
    echo "Testing SQL query with execute([...]) bind...\n";
    $stmt = $pdo->prepare("
        SELECT n.id, n.type, n.reference_id, n.sender_id, n.message_text, n.is_read, n.created_at,
               up.profile_image AS sender_avatar
        FROM notifications n
        LEFT JOIN user_profiles up ON n.sender_id = up.user_id
        WHERE n.user_id = :uid
        ORDER BY n.created_at DESC
        LIMIT :limit OFFSET :offset
    ");
    
    $stmt->bindValue(':uid', $uid, PDO::PARAM_INT);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Success! Found " . count($notifications) . " notifications.\n";
    print_r($notifications[0] ?? "No notifications yet.");
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
