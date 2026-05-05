<?php
require_once __DIR__ . '/../backend/core/db.php';
$pdo = getDB();

try {
    $columns = $pdo->query("DESCRIBE scores")->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('composition_json', $columns)) {
        $pdo->exec("ALTER TABLE scores ADD COLUMN composition_json TEXT AFTER status");
        echo "Column 'composition_json' added to scores table.\n";
    } else {
        echo "Column 'composition_json' already exists.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
