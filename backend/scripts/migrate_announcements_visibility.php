<?php
require_once __DIR__ . '/../core/db.php';

try {
    $pdo = getDB();
    
    // Check if column already exists
    $stmt = $pdo->prepare("SHOW COLUMNS FROM `announcements` LIKE 'is_visible'");
    $stmt->execute();
    $column = $stmt->fetch();
    
    if (!$column) {
        $pdo->exec("ALTER TABLE `announcements` ADD COLUMN `is_visible` TINYINT(1) DEFAULT 1");
        echo "Column `is_visible` successfully added to `announcements` table.\n";
    } else {
        echo "Column `is_visible` already exists.\n";
    }
} catch (Exception $e) {
    echo "Migration Error: " . $e->getMessage() . "\n";
}
?>
