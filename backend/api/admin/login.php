<?php
require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/auth_helper.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/rate_limit_helper.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Method not allowed.', null, 405);
}

$pdo = getDB();

// Rate limit: max 5 admin login attempts per IP per 15 minutes
$_rlKey = 'admin_login_' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
checkRateLimit($pdo, $_rlKey, 5, 900);

$input = json_decode(file_get_contents('php://input'), true);
$user = $input['username'] ?? '';
$pass = $input['password'] ?? '';

if ($user === ADMIN_USER && $pass === ADMIN_PASS) {
    $token = 'ADM-' . generateRandomString(40);

    $stmt = $pdo->prepare("INSERT INTO admin_sessions (token) VALUES (?)");
    $stmt->execute([$token]);

    jsonResponse(true, 'Login successful.', ['admin_token' => $token]);
} else {
    recordAttempt($pdo, $_rlKey);
    jsonResponse(false, 'Invalid credentials.', null, 401);
}
