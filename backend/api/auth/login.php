<?php
$pdo = getDB();

$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

if (empty($email) || empty($password)) {
    jsonResponse(false, 'Phone number/email and password are required.');
}

// Allow login by email or mobile
$stmt = $pdo->prepare("SELECT * FROM users WHERE (email = ? OR mobile = ?) AND status = 'active'");
$stmt->execute([$email, $email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonResponse(false, 'Invalid phone number/email or password.');
}

// Rules say User cannot log in until required verification is complete.
if ((int)$user['is_email_verified'] === 0 || (int)$user['is_phone_verified'] === 0) {
    jsonResponse(false, 'Please verify your email and phone before logging in.', [
        'needs_verification' => true,
        'user_id' => $user['id']
    ]);
}

// Generate auth token
$authToken = generateRandomString(40);
$updateToken = $pdo->prepare("UPDATE users SET auth_token = ? WHERE id = ?");
$updateToken->execute([$authToken, $user['id']]);

// Check if user has profile
$stmtProf = $pdo->prepare("SELECT id, level FROM user_profiles WHERE user_id = ?");
$stmtProf->execute([$user['id']]);
$profData = $stmtProf->fetch();
$hasProfile = $profData !== false && !empty($profData['level']);

jsonResponse(true, 'Login successful', [
    'token' => $authToken,
    'user' => [
        'id' => $user['id'],
        'first_name' => $user['first_name'],
        'last_name' => $user['last_name'],
        'email' => $user['email']
    ],
    'has_profile' => $hasProfile
]);
?>
