<?php
require_once dirname(__DIR__) . '/backend/core/db.php';
$pdo = getDB();

$matchCode = 'M-H640';
// Past 2 hours
$newTime = date('Y-m-d H:i:s', strtotime('-2 hours'));

try {
    $stmt = $pdo->prepare("UPDATE matches SET match_datetime = ? WHERE match_code = ?");
    $stmt->execute([$newTime, $matchCode]);
    
    if ($stmt->rowCount() > 0) {
        echo "Successfully updated match $matchCode to $newTime\n";
    } else {
        echo "Match $matchCode not found or time already correct.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
