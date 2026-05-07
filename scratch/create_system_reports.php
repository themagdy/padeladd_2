<?php
require_once __DIR__ . '/../backend/core/db.php';
$pdo = getDB();

$sql = "CREATE TABLE IF NOT EXISTS system_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    reason_text TEXT NOT NULL,
    status ENUM('pending', 'resolved') DEFAULT 'pending',
    is_archived TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

try {
    $pdo->exec($sql);
    echo "Table system_reports created successfully.\n";
} catch (Exception $e) {
    echo "Error creating table: " . $e->getMessage() . "\n";
}
