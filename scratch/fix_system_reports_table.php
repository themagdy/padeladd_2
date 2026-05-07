<?php
require_once __DIR__ . '/../backend/core/db.php';
$pdo = getDB();

try {
    // Rename report_text to reason_text
    $pdo->exec("ALTER TABLE system_reports CHANGE COLUMN report_text reason_text TEXT NOT NULL");
    
    // Change status enum and default
    $pdo->exec("ALTER TABLE system_reports MODIFY COLUMN status ENUM('pending', 'resolved') DEFAULT 'pending'");
    
    echo "Table system_reports structure updated successfully.\n";
} catch (Exception $e) {
    echo "Error updating table: " . $e->getMessage() . "\n";
}
