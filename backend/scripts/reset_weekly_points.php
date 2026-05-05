<?php
/**
 * Reset Weekly Points Script
 * Should be run once a week via cron (e.g., Sunday night).
 */

require_once __DIR__ . '/../core/db.php';

try {
    $pdo = getDB();
    
    // Reset points_this_week for all players
    $stmt = $pdo->prepare("UPDATE player_stats SET points_this_week = 0");
    $stmt->execute();
    
    echo "Successfully reset weekly points for all players.\n";
    
} catch (Exception $e) {
    error_log("Reset Weekly Points Error: " . $e->getMessage());
    echo "Error: " . $e->getMessage() . "\n";
}
