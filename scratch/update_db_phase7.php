<?php
require_once __DIR__ . '/../backend/core/db.php';

try {
    $db = getDB();
    $sql = file_get_contents(__DIR__ . '/../database/schema/04_phase7_scoring.sql');
    
    // Split by semicolon to execute multiple statements
    $statements = array_filter(array_map('trim', explode(';', $sql)));
    
    foreach ($statements as $stmt) {
        if (!empty($stmt)) {
            $db->exec($stmt);
        }
    }
    
    echo "Database updated successfully!\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
