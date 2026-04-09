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
    $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));
    
    $insert = $pdo->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
    $insert->execute([$email, $token, $expiresAt]);
    
    // Send email logic here...
    // For Phase 1 demo, return token in response to simulate flow
    jsonResponse(true, "Check your inbox! We've sent a reset link to your email.", ['test_reset_token' => $token]);
}

// If email not found or not active
jsonResponse(false, "We couldn't find an active account with that email address.");
?>
