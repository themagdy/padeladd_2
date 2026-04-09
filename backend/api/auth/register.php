<?php
$pdo = getDB();

$firstName = trim($data['first_name'] ?? '');
$lastName = trim($data['last_name'] ?? '');
$mobile = trim($data['mobile'] ?? '');
$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

// Validate
if (empty($firstName) || empty($lastName) || empty($mobile) || empty($email) || empty($password)) {
    jsonResponse(false, 'All fields are required.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(false, 'Invalid email address.');
}

if (!preg_match('/^01[0125][0-9]{8}$/', $mobile)) {
    jsonResponse(false, 'Invalid Egyptian mobile number. Must be 11 digits starting with 01.');
}

// Check uniqueness (Only blocking if verified)
$stmt = $pdo->prepare("SELECT id, email, mobile, is_email_verified, is_phone_verified FROM users WHERE email = ? OR mobile = ?");
$stmt->execute([$email, $mobile]);
$existing = $stmt->fetch();

if ($existing) {
    // If it's the exact same email AND same mobile, we allow "Restarting" by deleting stale
    if ($existing['email'] === $email && $existing['mobile'] === $mobile && !$existing['is_email_verified'] && !$existing['is_phone_verified']) {
        $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$existing['id']]);
    } else {
        // Otherwise, if either is already verified OR if it's a cross-match, block it.
        if ($existing['email'] === $email) {
            jsonResponse(false, 'Email is already registered.');
        } else {
            jsonResponse(false, 'Mobile number is already registered.');
        }
    }
}

$passwordHash = password_hash($password, PASSWORD_DEFAULT);

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("INSERT INTO users (first_name, last_name, mobile, email, password_hash) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$firstName, $lastName, $mobile, $email, $passwordHash]);
    $userId = $pdo->lastInsertId();

    // Generate codes
    $emailCode = generateRandomString(32);
    $smsCode = generateNumericCode(6);
    $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

    $stmtCode = $pdo->prepare("INSERT INTO verification_codes (user_id, code_type, code_value, expires_at) VALUES (?, ?, ?, ?), (?, ?, ?, ?)");
    $stmtCode->execute([
        $userId, 'email', $emailCode, $expiresAt,
        $userId, 'sms', $smsCode, $expiresAt
    ]);

    $pdo->commit();

    // In a real app, send Email & SMS here. 
    // We return the codes/links in the response temporarily for easy testing during Phase 1.
    jsonResponse(true, 'Registration successful. Please verify your account.', [
        'user_id' => $userId,
        'test_email_link' => "/verify-email?token=" . $emailCode,
        'test_sms_code' => $smsCode
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    error_log("Register error: " . $e->getMessage());
    jsonResponse(false, 'Registration failed due to a server error.');
}
?>
