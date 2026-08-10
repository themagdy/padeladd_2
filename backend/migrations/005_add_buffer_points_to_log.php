<?php
/**
 * Migration: Add buffer_points to player_points_log table.
 * Safe to run multiple times.
 * Run at: http://localhost:8888/padeladd4/backend/migrations/005_add_buffer_points_to_log.php
 */
require_once __DIR__ . '/../core/db.php';

try {
    $pdo = getDB();
    
    // Check if buffer_points column exists
    $check = $pdo->query("SHOW COLUMNS FROM player_points_log LIKE 'buffer_points'")->fetch();
    if (!$check) {
        $pdo->exec("
            ALTER TABLE player_points_log 
            ADD COLUMN buffer_points INT DEFAULT 0 AFTER change_amount
        ");
        echo json_encode(['success' => true, 'message' => 'buffer_points column successfully added.']);
    } else {
        echo json_encode(['success' => true, 'message' => 'buffer_points column already exists. No action taken.']);
    }
} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
