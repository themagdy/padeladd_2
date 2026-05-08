<?php
/**
 * POST /api/auth/resend-otp
 * Resends the WhatsApp verification code.
 */
$pdo = getDB();

$userId = (int)($data['user_id'] ?? 0);

if ($userId <= 0) {
    jsonResponse(false, 'User ID is required.');
}

// Fetch user mobile
$stmt = $pdo->prepare("SELECT mobile, is_phone_verified FROM users WHERE id = ?");
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    jsonResponse(false, 'User not found.');
}

if ((int)$user['is_phone_verified'] === 1) {
    jsonResponse(true, 'Phone is already verified.');
}

// Check for existing valid code to reuse or replace
$stmtCode = $pdo->prepare("SELECT code_value FROM verification_codes WHERE user_id = ? AND code_type = 'sms' AND is_used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1");
$stmtCode->execute([$userId]);
$existingCode = $stmtCode->fetchColumn();

if ($existingCode) {
    $smsCode = $existingCode;
} else {
    $smsCode = generateNumericCode(6);
    $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
    $stmtIns = $pdo->prepare("INSERT INTO verification_codes (user_id, code_type, code_value, expires_at) VALUES (?, 'sms', ?, ?)");
    $stmtIns->execute([$userId, $smsCode, $expiresAt]);
}

// Send WhatsApp
$sent = sendWhatsAppOTP($user['mobile'], $smsCode);

if ($sent) {
    jsonResponse(true, 'Verification code resent to WhatsApp.');
} else {
    jsonResponse(false, 'Failed to send WhatsApp message. Please try again later.');
}
