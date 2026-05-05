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
    // Check if user already has an active session
    $stmtSession = $pdo->prepare("SELECT token FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1");
    $stmtSession->execute([$userId]);
    $session = $stmtSession->fetch();
    
    if ($session) {
        $authToken = $session['token'];
    } else {
        $authToken = generateRandomString(40);
        $pdo->prepare("INSERT INTO user_sessions (user_id, token) VALUES (?, ?)")->execute([$userId, $authToken]);
    }
}

// Check if profile exists
$stmtProf = $pdo->prepare("SELECT id, level FROM user_profiles WHERE user_id = ?");
$stmtProf->execute([$userId]);
$profData = $stmtProf->fetch();
$hasProfile = $profData !== false && !empty($profData['level']);

jsonResponse(true, 'Status retrieved.', [
    'email_verified' => $emailV,
    'phone_verified' => $phoneV,
    'token' => $authToken,
    'has_profile' => $hasProfile
]);
?>
