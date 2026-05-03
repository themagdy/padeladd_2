<?php
/**
 * Script to remove temporary test matches created for pagination testing.
 * Run this in your browser: /temp_scripts/remove_test_matches.php
 */

require_once __DIR__ . '/../backend/core/db.php';

$pdo = getDB();
$venueName = "TEST_PAGINATION";

echo "Cleaning up matches with venue '$venueName'...<br>";

// We only need to delete from 'matches' because of ON DELETE CASCADE
$stmt = $pdo->prepare("DELETE FROM matches WHERE venue_name = ?");
$stmt->execute([$venueName]);

$count = $stmt->rowCount();

echo "Successfully removed $count test matches.";
