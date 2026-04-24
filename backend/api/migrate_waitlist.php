<?php
require_once __DIR__ . '/../core/db.php';
$pdo = getDB();

try {
    // 1. Make partner_id nullable
    $pdo->exec("ALTER TABLE waiting_list MODIFY partner_id INT NULL");
    echo "Migration successful: partner_id is now nullable.\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
