<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();
$data = json_decode(file_get_contents('php://input'), true);

$heading = $data['heading'] ?? '';
$emoji = $data['emoji'] ?? '👋';
$body = $data['body'] ?? '';
$target_type = $data['target_type'] ?? 'all';
$target_player_code = $data['target_player_code'] ?? '';
$button_text = $data['button_text'] ?? 'Got it';
$action_type = $data['action_type'] ?? 'close';
$page_route = $data['page_route'] ?? null;
$android_url = $data['android_url'] ?? null;
$ios_url = $data['ios_url'] ?? null;
$is_active = isset($data['is_active']) ? (int)$data['is_active'] : 1;
$is_undismissable = isset($data['is_undismissable']) ? (int)$data['is_undismissable'] : 0;

if (empty($heading) || empty($body)) {
    jsonResponse(false, 'Heading and Body are required.', null, 422);
}

$target_user_id = null;
if ($target_type === 'specific' && !empty($target_player_code)) {
    $stmt = $pdo->prepare("SELECT user_id FROM user_profiles WHERE player_code = ?");
    $stmt->execute([$target_player_code]);
    $target_user_id = $stmt->fetchColumn();
    if (!$target_user_id) {
        jsonResponse(false, 'Target player code not found.', null, 404);
    }
}

$target_build_refs = isset($data['target_build_refs']) ? json_encode($data['target_build_refs']) : null;

try {
    $sql = "
        INSERT INTO in_app_messages 
        (target_user_id, target_build_refs, heading, emoji, body, button_text, action_type, page_route, android_url, ios_url, is_active, is_undismissable)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $target_user_id, $target_build_refs, $heading, $emoji, $body, $button_text, $action_type, $page_route, $android_url, $ios_url, $is_active, $is_undismissable
    ]);

    jsonResponse(true, 'Message created successfully.');
} catch (Exception $e) {
    jsonResponse(false, 'Failed to create message: ' . $e->getMessage(), null, 500);
}
