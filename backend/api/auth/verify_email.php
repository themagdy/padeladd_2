<?php
$pdo = getDB();

$code = trim($data['code'] ?? '');

if (empty($code)) {
    jsonResponse(false, 'Verification code is required.');
}

$stmt = $pdo->prepare("SELECT * FROM verification_codes WHERE code_value = ? AND code_type = 'email' AND is_used = 0 AND expires_at > NOW()");
$stmt->execute([$code]);
$tokenRow = $stmt->fetch();

if (!$tokenRow) {
    jsonResponse(false, 'Invalid or expired verification link.');
}

try {
    $pdo->beginTransaction();
    
    // Mark verified
    $updateUser = $pdo->prepare("UPDATE users SET is_email_verified = 1 WHERE id = ?");
    $updateUser->execute([$tokenRow['user_id']]);

    // Mark code used
    $updateCode = $pdo->prepare("UPDATE verification_codes SET is_used = 1 WHERE id = ?");
    $updateCode->execute([$tokenRow['id']]);

    $pdo->commit();
    jsonResponse(true, 'Email successfully verified.');
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(false, 'Verification failed due to server error.');
}
?>
