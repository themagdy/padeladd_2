<?php
require_once 'backend/core/config.php';
require_once 'backend/core/db.php';

try {
    $db = getDB();
    $stmt = $db->query("SELECT id, first_name, last_name, email, mobile, created_at FROM users ORDER BY created_at DESC LIMIT 1");
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user) {
        echo "LAST REGISTERED PLAYER:\n";
        echo "------------------------\n";
        echo "Name: " . $user['first_name'] . " " . $user['last_name'] . "\n";
        echo "Email: " . $user['email'] . "\n";
        echo "Mobile: " . $user['mobile'] . "\n";
        echo "Registered At: " . $user['created_at'] . " (ID: " . $user['id'] . ")\n";
    } else {
        echo "No users found in the database.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
