<?php
require_once __DIR__ . '/../backend/core/db.php';
try {
    $db = getDB();
    $db->exec("ALTER TABLE scores ADD COLUMN composition_json TEXT NULL AFTER t2_set3;");
    echo "Column added successfully!\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
