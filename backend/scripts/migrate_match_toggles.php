<?php
require_once __DIR__ . '/../core/db.php';

try {
    $pdo = getDB();
    
    // Add gender_type
    $pdo->exec("ALTER TABLE matches ADD COLUMN gender_type ENUM('open', 'same_gender') DEFAULT 'open'");
    echo "Added gender_type column.\n";
    
    // Add match_type
    $pdo->exec("ALTER TABLE matches ADD COLUMN match_type ENUM('friendly', 'competitive') DEFAULT 'friendly'");
    echo "Added match_type column.\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
