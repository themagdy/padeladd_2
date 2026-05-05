<?php
$pdo = getDB();

$userId = $data['user_id'] ?? null;
$code = trim($data['code'] ?? '');

if (empty($userId) || empty($code)) {
    jsonResponse(false, 'User ID and OTP are required.');
}

$stmtCheck = $pdo->prepare("SELECT is_phone_verified FROM users WHERE id = ?");
$stmtCheck->execute([$userId]);
$u = $stmtCheck->fetch();

if ($u && $u['is_phone_verified']) {
    // Already verified! Don't throw an error, just succeed.
    jsonResponse(true, 'Phone is already verified.', ['already_verified' => true]);
}

$stmt = $pdo->prepare("SELECT * FROM verification_codes WHERE user_id = ? AND code_value = ? AND code_type = 'sms' AND is_used = 0 AND expires_at > NOW()");
$stmt->execute([$userId, $code]);
$tokenRow = $stmt->fetch();

if (!$tokenRow) {
    jsonResponse(false, 'Invalid or expired OTP.');
}

try {
    $pdo->beginTransaction();
    
    // Mark verified
    $updateUser = $pdo->prepare("UPDATE users SET is_phone_verified = 1 WHERE id = ?");
    $updateUser->execute([$userId]);

    // Mark code used
    $updateCode = $pdo->prepare("UPDATE verification_codes SET is_used = 1 WHERE id = ?");
    $updateCode->execute([$tokenRow['id']]);

    // Cleanup: Remove any other unverified accounts using this verified phone
    $verifiedMobile = $pdo->prepare("SELECT mobile FROM users WHERE id = ?");
    $verifiedMobile->execute([$userId]);
    $mobileStr = $verifiedMobile->fetchColumn();
    if ($mobileStr) {
        $pdo->prepare("DELETE FROM users WHERE mobile = ? AND is_phone_verified = 0 AND is_email_verified = 0 AND id != ?")->execute([$mobileStr, $userId]);
    }

    $pdo->commit();

    // Check if fully verified to auto-login
    $stmtCheck = $pdo->prepare("SELECT is_email_verified, is_phone_verified FROM users WHERE id = ?");
    $stmtCheck->execute([$userId]);
    $u = $stmtCheck->fetch();

    $authToken = null;
    $hasProfile = false;
    if ($u['is_email_verified'] && $u['is_phone_verified']) {
        $authToken = generateRandomString(40);
        $pdo->prepare("INSERT INTO user_sessions (user_id, token) VALUES (?, ?)")->execute([$userId, $authToken]);
        
        // Check if profile exists
        $stmtProf = $pdo->prepare("SELECT id, level FROM user_profiles WHERE user_id = ?");
        $stmtProf->execute([$userId]);
        $profData = $stmtProf->fetch();
        $hasProfile = $profData !== false && !empty($profData['level']);
    }

    jsonResponse(true, 'Phone successfully verified.', [
        'token' => $authToken,
        'has_profile' => $hasProfile,
        'fully_verified' => ($authToken !== null)
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(false, 'OTP Verification failed due to server error.');
}
?>
