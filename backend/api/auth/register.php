<?php
require_once __DIR__ . '/../../helpers/rate_limit_helper.php';

$pdo = getDB();

// Rate limit: max 5 registration attempts per IP per hour
$_rlKey = 'register_' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
checkRateLimit($pdo, $_rlKey, 5, 3600);
recordAttempt($pdo, $_rlKey);

$firstName = trim($data['first_name'] ?? '');
$lastName = trim($data['last_name'] ?? '');
$mobile = trim($data['mobile'] ?? '');
$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

// Validate
if (empty($firstName) || empty($lastName) || empty($mobile) || empty($email) || empty($password)) {
    jsonResponse(false, 'All fields are required.');
}

if (strlen($password) < 8) {
    jsonResponse(false, 'Password must be at least 8 characters long.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(false, 'Invalid email address.');
}

if (!preg_match('/^01[0125][0-9]{8}$/', $mobile)) {
    jsonResponse(false, 'Invalid Egyptian mobile number. Must be 11 digits starting with 01.');
}

// Fetch invite-only mode setting
$modeStmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'invite_only_mode'");
$modeStmt->execute();
$modeVal = $modeStmt->fetchColumn();
$invite_only_mode = ($modeVal === '1');

$inviteCode = '';
if ($invite_only_mode) {
    $inviteCode = strtoupper(preg_replace('/[^A-Za-z0-9\-_]/', '', trim($data['invite_code'] ?? '')));
    if (empty($inviteCode)) {
        jsonResponse(false, 'An invitation code is required to register during our exclusive launch phase.');
    }
}

$passwordHash = password_hash($password, PASSWORD_DEFAULT);

try {
    $pdo->beginTransaction();

    // If invite-only, verify and lock the invite code row to prevent concurrent double-redemptions
    $inviteKeyId = null;
    if ($invite_only_mode) {
        $inviteStmt = $pdo->prepare("SELECT id, used_by_user_id FROM invite_keys WHERE code = ? FOR UPDATE");
        $inviteStmt->execute([$inviteCode]);
        $inviteKey = $inviteStmt->fetch(PDO::FETCH_ASSOC);

        if (!$inviteKey) {
            $pdo->rollBack();
            jsonResponse(false, 'The invitation code is invalid.');
        }
        if ($inviteKey['used_by_user_id'] !== null) {
            $pdo->rollBack();
            jsonResponse(false, 'This invitation code has already been used.');
        }
        $inviteKeyId = (int)$inviteKey['id'];
    }

    // Check uniqueness (lock matching rows with FOR UPDATE to prevent race conditions)
    $stmt = $pdo->prepare("SELECT id, is_email_verified, is_phone_verified, email, mobile FROM users WHERE email = ? OR mobile = ? FOR UPDATE");
    $stmt->execute([$email, $mobile]);
    $existingUsers = $stmt->fetchAll();

    foreach ($existingUsers as $existing) {
        // A record "claims" the email/mobile ONLY if it is BOTH email AND phone verified
        if ((int)$existing['is_email_verified'] === 1 && (int)$existing['is_phone_verified'] === 1) {
            $pdo->rollBack();
            if ($existing['email'] === $email) {
                jsonResponse(false, 'Email is already registered to a fully verified account.');
            }
            if ($existing['mobile'] === $mobile) {
                jsonResponse(false, 'Mobile number is already registered to a fully verified account.');
            }
        }
    }

    // If we reached here, any matches are not fully verified (pending one or both). 
    // Clear them out so this new registration can take ownership of the identifiers.
    foreach ($existingUsers as $existing) {
        $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$existing['id']]);
    }

    $stmt = $pdo->prepare("INSERT INTO users (first_name, last_name, mobile, email, password_hash) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$firstName, $lastName, $mobile, $email, $passwordHash]);
    $userId = $pdo->lastInsertId();

    // Consume the invitation code by linking it to the registered user
    if ($invite_only_mode && $inviteKeyId !== null) {
        $updateInviteStmt = $pdo->prepare("UPDATE invite_keys SET used_by_user_id = ?, used_at = NOW() WHERE id = ?");
        $updateInviteStmt->execute([$userId, $inviteKeyId]);
    }

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

    // Send WhatsApp OTP
    sendWhatsAppOTP($mobile, $smsCode);

    jsonResponse(true, 'Registration successful. We\'ve sent a verification link to your email and an OTP to your WhatsApp.', ['user_id' => $userId]);

} catch (Exception $e) {
    $pdo->rollBack();
    error_log("Register error: " . $e->getMessage());
    jsonResponse(false, 'Registration failed due to a server error.');
}
?>
