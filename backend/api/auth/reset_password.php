<?php
$pdo = getDB();

$token = trim($data['token'] ?? '');
$newPassword = $data['new_password'] ?? '';

if (empty($token) || empty($newPassword)) {
    jsonResponse(false, 'Token and new password are required.');
}

$stmt = $pdo->prepare("SELECT * FROM password_resets WHERE token = ? AND is_used = 0 AND expires_at > NOW()");
$stmt->execute([$token]);
$reset = $stmt->fetch();

if (!$reset) {
    jsonResponse(false, 'Invalid or expired reset token.');
}

try {
    $pdo->beginTransaction();
    
    $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $updateUser = $pdo->prepare("UPDATE users SET password_hash = ? WHERE email = ?");
    $updateUser->execute([$passwordHash, $reset['email']]);

    $updateReset = $pdo->prepare("UPDATE password_resets SET is_used = 1 WHERE id = ?");
    $updateReset->execute([$reset['id']]);

    $pdo->commit();
    jsonResponse(true, 'Password successfully reset.');
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(false, 'Error resetting password.');
}
?>
