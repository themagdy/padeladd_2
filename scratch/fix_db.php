<?php
require_once __DIR__ . '/../backend/core/db.php';
$pdo = getDB();

try {
    // Add win_rate if missing
    $columns = $pdo->query("DESCRIBE player_stats")->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('win_rate', $columns)) {
        $pdo->exec("ALTER TABLE player_stats ADD COLUMN win_rate INT DEFAULT 0 AFTER matches_lost");
        echo "Column 'win_rate' added.\n";
    }
    
    if (!in_array('streak', $columns)) {
        $pdo->exec("ALTER TABLE player_stats ADD COLUMN streak INT DEFAULT 0 AFTER win_rate");
        echo "Column 'streak' added.\n";
    }

    if (!in_array('points_this_week', $columns)) {
        $pdo->exec("ALTER TABLE player_stats ADD COLUMN points_this_week INT DEFAULT 0 AFTER streak");
        echo "Column 'points_this_week' added.\n";
    }
    
    // Populate existing values
    $pdo->exec("UPDATE player_stats SET win_rate = IF(matches_played > 0, FLOOR((matches_won * 100) / matches_played), 0)");
    echo "Values updated.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
