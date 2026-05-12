<?php
/**
 * Migration: Create rate_limits table for brute-force protection.
 * Safe to run multiple times (uses IF NOT EXISTS).
 * Run at: http://localhost:8888/padeladd4/backend/migrations/001_create_rate_limits.php
 */
require_once __DIR__ . '/../core/db.php';

try {
    $pdo = getDB();
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS rate_limits (
            id INT AUTO_INCREMENT PRIMARY KEY,
            limit_key VARCHAR(255) NOT NULL,
            attempts INT DEFAULT 1,
            window_start DATETIME NOT NULL,
            INDEX idx_key (limit_key)
        )
    ");
    echo json_encode(['success' => true, 'message' => 'rate_limits table created (or already exists).']);
} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
