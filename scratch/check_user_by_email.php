<?php
require_once 'backend/core/config.php';
require_once 'backend/core/db.php';

try {
    $db = getDB();
    $email = 'test11@gmail.com';
    $stmt = $db->prepare("SELECT id, first_name, last_name, email, mobile, created_at FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user) {
        echo "PLAYER FOUND:\n";
        echo "-------------\n";
        echo "Name: " . $user['first_name'] . " " . $user['last_name'] . "\n";
        echo "Email: " . $user['email'] . "\n";
        echo "Mobile: " . $user['mobile'] . "\n";
        echo "Registered At: " . $user['created_at'] . " (ID: " . $user['id'] . ")\n";
    } else {
        echo "No user found with email: $email\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
