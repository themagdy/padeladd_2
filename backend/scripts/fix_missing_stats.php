<?php
require_once __DIR__ . '/../core/db.php';

try {
    $pdo = getDB();
    
    // Find all users who have a profile but no stats entry
    $stmt = $pdo->query("
        SELECT up.user_id 
        FROM user_profiles up
        LEFT JOIN player_stats ps ON up.user_id = ps.user_id
        WHERE ps.user_id IS NULL
    ");
    
    $missingUsers = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $count = 0;
    if (!empty($missingUsers)) {
        $insert = $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, points) VALUES (?, 50)");
        
        foreach ($missingUsers as $userId) {
            $insert->execute([$userId]);
            $count++;
        }
    }
    
    echo "Successfully added $count missing players to player_stats.\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
