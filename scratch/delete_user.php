<?php
require_once 'backend/core/config.php';
require_once 'backend/core/db.php';

try {
    $db = getDB();
    
    // Using ID 29 for the latest user
    $userId = 29;
    
    $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    
    if ($stmt->rowCount() > 0) {
        echo "SUCCESS: User ID $userId has been removed.\n";
    } else {
        echo "WARNING: User ID $userId not found.\n";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
