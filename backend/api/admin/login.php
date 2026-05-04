<?php
require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/auth_helper.php';
require_once __DIR__ . '/../../helpers/response.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Method not allowed.', null, 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$user = $input['username'] ?? '';
$pass = $input['password'] ?? '';

if ($user === ADMIN_USER && $pass === ADMIN_PASS) {
    $token = 'ADM-' . generateRandomString(40);
    
    $pdo = getDB();
    $stmt = $pdo->prepare("INSERT INTO admin_sessions (token) VALUES (?)");
    $stmt->execute([$token]);
    
    jsonResponse(true, 'Login successful.', ['admin_token' => $token]);
} else {
    jsonResponse(false, 'Invalid credentials.', null, 401);
}
