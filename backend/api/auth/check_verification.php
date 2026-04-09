<?php
$pdo = getDB();
$userId = $data['user_id'] ?? 0;

if (!$userId) {
    jsonResponse(false, 'User ID required.');
}

$stmt = $pdo->prepare("SELECT is_email_verified, is_phone_verified FROM users WHERE id = ?");
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    jsonResponse(false, 'User not found.');
}

$emailV = (int)$user['is_email_verified'];
$phoneV = (int)$user['is_phone_verified'];
$authToken = null;

if ($emailV && $phoneV) {
    // Already has token?
    if (!empty($user['auth_token'])) {
        $authToken = $user['auth_token'];
    } else {
        $authToken = generateRandomString(40);
        $pdo->prepare("UPDATE users SET auth_token = ? WHERE id = ?")->execute([$authToken, $userId]);
    }
}

jsonResponse(true, 'Status retrieved.', [
    'email_verified' => $emailV,
    'phone_verified' => $phoneV,
    'token' => $authToken
]);
?>
