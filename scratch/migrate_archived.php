<?php
require_once __DIR__ . '/../backend/core/db.php';
$pdo = getDB();

try {
    $pdo->exec("ALTER TABLE match_reports ADD COLUMN is_archived TINYINT(1) DEFAULT 0");
    echo "match_reports updated.\n";
} catch(Exception $e) { echo "match_reports skip: " . $e->getMessage() . "\n"; }

try {
    $pdo->exec("ALTER TABLE profile_reports ADD COLUMN is_archived TINYINT(1) DEFAULT 0");
    echo "profile_reports updated.\n";
} catch(Exception $e) { echo "profile_reports skip: " . $e->getMessage() . "\n"; }

try {
    $pdo->exec("ALTER TABLE match_events ADD COLUMN is_archived TINYINT(1) DEFAULT 0");
    echo "match_events updated.\n";
} catch(Exception $e) { echo "match_events skip: " . $e->getMessage() . "\n"; }
