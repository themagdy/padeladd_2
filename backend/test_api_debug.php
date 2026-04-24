<?php
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/auth_helper.php';

// Simulate a logged in user (id = 1 is usually the first user)
function getAuthenticatedUser($pdo) {
    return ['id' => 1]; 
}

$pdo = getDB();
$data = ['mode' => 'mine_upcoming'];

echo "--- TESTING matches/user.php ---\n";
try {
    require __DIR__ . '/api/matches/user.php';
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . " in " . $e->getFile() . " line " . $e->getLine() . "\n";
}

echo "\n--- TESTING match/list.php ---\n";
try {
    require __DIR__ . '/api/match/list.php';
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . " in " . $e->getFile() . " line " . $e->getLine() . "\n";
}
