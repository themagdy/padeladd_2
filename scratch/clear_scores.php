<?php
require_once __DIR__ . '/../backend/core/db.php';

$pdo = getDB();

try {
    // 1. Delete all scores (disputes will be deleted via CASCADE)
    $pdo->exec("DELETE FROM scores");
    echo "Deleted all scores.\n";

    // 2. Delete all disputes (just in case)
    $pdo->exec("DELETE FROM disputes");
    echo "Deleted all disputes.\n";

    // 3. Delete all match reports
    $pdo->exec("DELETE FROM match_reports");
    echo "Deleted all match reports.\n";

    // 4. Reset completed matches back to full
    $pdo->exec("UPDATE matches SET status = 'full' WHERE status = 'completed'");
    echo "Reset completed matches to 'full'.\n";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
