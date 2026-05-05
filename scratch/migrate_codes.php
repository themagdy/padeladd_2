<?php
require_once __DIR__ . '/../backend/core/db.php';
require_once __DIR__ . '/../backend/helpers/auth_helper.php';

$pdo = getDB();

$stmt = $pdo->query("SELECT user_id, player_code FROM user_profiles");
$profiles = $stmt->fetchAll(PDO::FETCH_ASSOC);

$updateStmt = $pdo->prepare("UPDATE user_profiles SET player_code = ? WHERE user_id = ?");

echo "Updating " . count($profiles) . " profiles...\n";

foreach ($profiles as $p) {
    $userId = $p['user_id'];
    $oldCode = $p['player_code'];
    
    // Generate a new code
    $newCode = generateUniquePlayerCode($pdo);
    
    if ($newCode) {
        $updateStmt->execute([$newCode, $userId]);
        echo "Updated User ID $userId: $oldCode -> $newCode\n";
    } else {
        echo "FAILED to generate code for User ID $userId\n";
    }
}

echo "Done.\n";
