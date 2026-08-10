<?php
/**
 * Migration: Add score_id to player_points_log table.
 * Safe to run multiple times.
 * Run at: http://localhost:8888/padeladd4/backend/migrations/004_add_score_id_to_points_log.php
 */
require_once __DIR__ . '/../core/db.php';

try {
    $pdo = getDB();
    
    // Check if score_id column exists
    $check = $pdo->query("SHOW COLUMNS FROM player_points_log LIKE 'score_id'")->fetch();
    if (!$check) {
        $pdo->exec("
            ALTER TABLE player_points_log 
            ADD COLUMN score_id INT NULL AFTER match_id,
            ADD CONSTRAINT fk_points_log_score FOREIGN KEY (score_id) REFERENCES scores(id) ON DELETE SET NULL
        ");
        echo json_encode(['success' => true, 'message' => 'score_id column and foreign key constraint successfully added.']);
    } else {
        echo json_encode(['success' => true, 'message' => 'score_id column already exists. No action taken.']);
    }
} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
