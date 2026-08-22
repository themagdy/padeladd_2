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
$logFile = __DIR__ . '/../../logs/token_debug.log';
$logDir = dirname($logFile);
if (!is_dir($logDir)) { @mkdir($logDir, 0777, true); }

$stmt = $pdo->prepare("
    INSERT INTO user_device_tokens (user_id, token, platform)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE 
        user_id = VALUES(user_id),
        platform = VALUES(platform),
        last_updated = CURRENT_TIMESTAMP
");

if ($stmt->execute([$uid, $token, $platform])) {
    @file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "SUCCESS: User {$uid}, Platform {$platform}, Token: " . substr($token, 0, 20) . "...\n", FILE_APPEND);
    jsonResponse(true, 'Device token updated.');
} else {
    @file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "FAILED: User {$uid}, Platform {$platform}, Token: {$token}\n", FILE_APPEND);
    jsonResponse(false, 'Failed to update device token.');
}
