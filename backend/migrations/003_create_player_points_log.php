<?php
/**
 * Migration: Create player_points_log table.
 * Safe to run multiple times (uses IF NOT EXISTS).
 * Run at: http://localhost:8888/padeladd4/backend/migrations/003_create_player_points_log.php
 */
require_once __DIR__ . '/../core/db.php';

try {
    $pdo = getDB();
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS player_points_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            match_id INT NULL,
            points_before INT NOT NULL,
            points_after INT NOT NULL,
            change_amount INT NOT NULL,
            reason ENUM('initial_setup', 'match_completion', 'admin_override') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    echo json_encode(['success' => true, 'message' => 'player_points_log table created (or already exists).']);
} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
