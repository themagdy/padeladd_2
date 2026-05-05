<?php
/**
 * POST /api/profile/update_device_token
 * Updates or registers a push notification device token for the current user.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

$token = trim($data['token'] ?? '');
$platform = trim($data['platform'] ?? 'android');

if ($token === '') {
    jsonResponse(false, 'Token is required.', null, 422);
}

// Upsert the token
$stmt = $pdo->prepare("
    INSERT INTO user_device_tokens (user_id, token, platform)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE 
        user_id = VALUES(user_id),
        platform = VALUES(platform),
        last_updated = CURRENT_TIMESTAMP
");

if ($stmt->execute([$uid, $token, $platform])) {
    jsonResponse(true, 'Device token updated.');
} else {
    jsonResponse(false, 'Failed to update device token.');
}
