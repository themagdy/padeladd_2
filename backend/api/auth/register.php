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

// Check uniqueness
$stmt = $pdo->prepare("SELECT id, is_email_verified, is_phone_verified, email, mobile FROM users WHERE email = ? OR mobile = ?");
$stmt->execute([$email, $mobile]);
$existingUsers = $stmt->fetchAll();

foreach ($existingUsers as $existing) {
    // A record "claims" the email/mobile if it is EITHER email or phone verified
    if ((int)$existing['is_email_verified'] === 1 || (int)$existing['is_phone_verified'] === 1) {
        if ($existing['email'] === $email) {
            jsonResponse(false, 'Email is already registered and verified.');
        }
        if ($existing['mobile'] === $mobile) {
            jsonResponse(false, 'Mobile number is already registered and verified.');
        }
    }
}

// If we reached here, any matches are not fully verified (pending one or both). 
// Clear them out so this new registration can take ownership of the identifiers.
foreach ($existingUsers as $existing) {
    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$existing['id']]);
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

    // Send real email
    $verifyLink = SITE_URL . "/verify-email?token=" . $emailCode;
    $message = "Welcome to Padeladd! Please verify your email address to active your account and start your Padel journey.";
    sendEmail($email, "Welcome to Padeladd - Verify Your Email", $message, "Verify Email", $verifyLink);

    jsonResponse(true, 'Registration successful. We\'ve sent a verification link to your email address.', ['user_id' => $userId]);

} catch (Exception $e) {
    $pdo->rollBack();
    error_log("Register error: " . $e->getMessage());
    jsonResponse(false, 'Registration failed due to a server error.');
}
?>
