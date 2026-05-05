<?php
require_once __DIR__ . '/../backend/core/db.php';

try {
    $pdo = getDB();
    $pdo->exec("ALTER TABLE match_players ADD COLUMN reminder_sent tinyint(1) DEFAULT 0;");
    echo "Successfully added reminder_sent column to match_players.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
