<?php
$pdo = getDB();

$email = trim($data['email'] ?? '');

if (empty($email)) {
    jsonResponse(false, 'Email is required.');
}

$stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND status = 'active'");
$stmt->execute([$email]);
if ($stmt->rowCount() > 0) {
    // Generate reset token
    $token = generateRandomString(40);
    $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
    
    $insert = $pdo->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
    $insert->execute([$email, $token, $expiresAt]);
    
    // Send real email
    $resetLink = SITE_URL . "/reset-password?token=" . $token;
    $message = "We received a request to reset your Padeladd password. Click the button below to choose a new one.";
    sendEmail($email, "Reset Your Padeladd Password", $message, "Reset Password", $resetLink);
    
    $responseData = [];
    if (defined('APP_ENV') && APP_ENV === 'development') {
        $responseData['test_reset_token'] = $token;
    }
    
    jsonResponse(true, "Check your inbox! We've sent a reset link to your email.", $responseData);
}

// If email not found or not active
jsonResponse(false, "We couldn't find an active account with that email address.");
?>
