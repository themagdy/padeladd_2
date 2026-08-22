<?php
// Simple push notification diagnostic endpoint
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../helpers/fcm_helper.php';

$userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 1;

try {
    $stmt = $pdo->prepare("SELECT id, user_id, token, platform, last_updated FROM user_device_tokens WHERE user_id = ? ORDER BY id DESC");
    $stmt->execute([$userId]);
    $tokens = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $sendResult = null;
    if (isset($_GET['send']) && $_GET['send'] === 'true' && !empty($tokens)) {
        $sendResult = sendFCMNotification([$userId], "Test Push Notification", "This is a test notification from Padeladd API!");
    }

    echo json_encode([
        'success' => true,
        'user_id' => $userId,
        'token_count' => count($tokens),
        'tokens' => $tokens,
        'send_test_triggered' => (isset($_GET['send']) && $_GET['send'] === 'true'),
        'fcm_send_result' => $sendResult
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
