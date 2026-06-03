<?php
/**
 * Migration: Add created_at column to user_sessions for 90-day token expiry.
 * Safe to run multiple times - checks if column exists first.
 * Run at: https://padeladd.com/backend/migrations/002_session_expiry.php
 */
require_once __DIR__ . '/../core/db.php';

try {
    $pdo = getDB();

    $stmt = $pdo->query("SHOW COLUMNS FROM user_sessions LIKE 'created_at'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE user_sessions ADD COLUMN created_at DATETIME DEFAULT NOW()");
        echo json_encode(['success' => true, 'message' => 'created_at column added to user_sessions.']);
    } else {
        echo json_encode(['success' => true, 'message' => 'created_at column already exists. No changes made.']);
    }
} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
