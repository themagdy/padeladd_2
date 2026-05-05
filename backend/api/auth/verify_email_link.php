<?php
$pdo = getDB();
$token = trim($data['token'] ?? '');

if (empty($token)) {
    jsonResponse(false, 'Missing verification token.');
}

// Check if already used
$stmtCodeCheck = $pdo->prepare("SELECT user_id, is_used FROM verification_codes WHERE code_type = 'email' AND code_value = ?");
$stmtCodeCheck->execute([$token]);
$codeRow = $stmtCodeCheck->fetch();

if ($codeRow) {
    if ($codeRow['is_used'] == 1) {
        $stmtUser = $pdo->prepare("SELECT is_email_verified FROM users WHERE id = ?");
        $stmtUser->execute([$codeRow['user_id']]);
        $u = $stmtUser->fetch();
        if ($u && $u['is_email_verified']) {
            jsonResponse(true, 'Email is already verified.', ['already_verified' => true]);
        }
    }
}

// Proceed with active token check
$stmt = $pdo->prepare("SELECT user_id, id FROM verification_codes WHERE code_type = 'email' AND code_value = ? AND is_used = 0 AND expires_at > NOW()");
$stmt->execute([$token]);
$row = $stmt->fetch();

if (!$row) {
    jsonResponse(false, 'Invalid or expired verification link.');
}

try {
    $pdo->beginTransaction();

    // Mark as verified
    $stmtUpd = $pdo->prepare("UPDATE users SET is_email_verified = 1 WHERE id = ?");
    $stmtUpd->execute([$row['user_id']]);

    // Mark token as used
    $stmtDone = $pdo->prepare("UPDATE verification_codes SET is_used = 1 WHERE id = ?");
    $stmtDone->execute([$row['id']]);

    // Cleanup: Remove any other unverified accounts using this verified email
    $pdo->prepare("SELECT email FROM users WHERE id = ?")->execute([$row['user_id']]);
    $verifiedEmail = $pdo->prepare("SELECT email FROM users WHERE id = ?");
    $verifiedEmail->execute([$row['user_id']]);
    $emailStr = $verifiedEmail->fetchColumn();
    if ($emailStr) {
        $pdo->prepare("DELETE FROM users WHERE email = ? AND NOT (is_email_verified = 1 AND is_phone_verified = 1) AND id != ?")->execute([$emailStr, $row['user_id']]);
    }

    $pdo->commit();

    // Check if fully verified to auto-login
    $stmtCheck = $pdo->prepare("SELECT id, is_email_verified, is_phone_verified FROM users WHERE id = ?");
    $stmtCheck->execute([$row['user_id']]);
    $u = $stmtCheck->fetch();

    $authToken = null;
    $hasProfile = false;
    if ($u['is_email_verified'] && $u['is_phone_verified']) {
        $authToken = generateRandomString(40);
        $pdo->prepare("INSERT INTO user_sessions (user_id, token) VALUES (?, ?)")->execute([$u['id'], $authToken]);

        // Check if profile exists
        $stmtProf = $pdo->prepare("SELECT id, level FROM user_profiles WHERE user_id = ?");
        $stmtProf->execute([$u['id']]);
        $profData = $stmtProf->fetch();
        $hasProfile = $profData !== false && !empty($profData['level']);
    }

    jsonResponse(true, 'Email verified successfully.', [
        'token' => $authToken,
        'has_profile' => $hasProfile,
        'fully_verified' => ($authToken !== null)
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    error_log("Verify Link Error: " . $e->getMessage());
    jsonResponse(false, 'Verification failed due to a server error.');
}
?>
