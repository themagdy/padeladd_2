<?php
require_once __DIR__ . '/../../backend/core/db.php';
try {
    $pdo = getDB();
    $pdo->exec('TRUNCATE TABLE phone_requests');
    echo 'DB phone_requests cleared. You may test now!';
} catch(Exception $e) {
    echo 'Err: ' . $e->getMessage();
}

