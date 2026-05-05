<?php
require_once __DIR__ . '/../backend/core/db.php';

$pdo = getDB();
$email = 'aa@ahmedmagdy.com';

$stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    header('Content-Type: application/json');
    echo json_encode(['error' => 'User not found']);
    exit;
}

$stmt = $pdo->prepare("SELECT code_type, code_value FROM verification_codes WHERE user_id = ?");
$stmt->execute([$user['id']]);
$codes = $stmt->fetchAll();

$response = [
    'email' => $email,
    'user_id' => $user['id'],
    'codes' => $codes,
    'verify_link' => ''
];

foreach ($codes as $c) {
    if ($c['code_type'] === 'email') {
        $response['verify_link'] = "http://localhost/padeladd4/verify-email?token=" . $c['code_value'];
    }
}

header('Content-Type: application/json');
echo json_encode($response, JSON_PRETTY_PRINT);
?>
