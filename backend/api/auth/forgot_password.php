<?php
require_once __DIR__ . '/../../helpers/rate_limit_helper.php';

$pdo = getDB();

// Rate limit: max 3 forgot-password requests per IP per hour
$_rlKey = 'forgot_' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
checkRateLimit($pdo, $_rlKey, 3, 3600);
recordAttempt($pdo, $_rlKey);

$email = trim($data['email'] ?? '');

if (empty($email)) {
    jsonResponse(false, 'Email is required.');
}

// Always return the same message — prevents email enumeration
$stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND status IN ('active', 'suspended')");
$stmt->execute([$email]);
if ($stmt->rowCount() > 0) {
    $token = generateRandomString(40);
    $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

    $insert = $pdo->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
    $insert->execute([$email, $token, $expiresAt]);

    $resetLink = SITE_URL . "/reset-password?token=" . $token;
    $message = "We received a request to reset your Padeladd password. Click the button below to choose a new one.";
    sendEmail($email, "Reset Your Padeladd Password", $message, "Reset Password", $resetLink);
}

// Same response regardless of whether email was found — prevents enumeration
jsonResponse(true, "If this email is registered, you'll receive a reset link shortly.");
?>
