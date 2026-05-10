<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['id'])) {
    jsonResponse(false, 'Message ID is required');
}

$sql = "UPDATE in_app_messages SET 
        target_user_id = ?, 
        target_build_refs = ?, 
        heading = ?, 
        emoji = ?, 
        body = ?, 
        button_text = ?, 
        action_type = ?, 
        page_route = ?, 
        android_url = ?, 
        ios_url = ?, 
        is_active = ?,
        is_undismissable = ?
        WHERE id = ?";

// Get user ID from player code if specific
$target_user_id = null;
if ($data['target_type'] === 'specific' && !empty($data['target_player_code'])) {
    $stmt = $pdo->prepare("SELECT user_id FROM user_profiles WHERE player_code = ?");
    $stmt->execute([$data['target_player_code']]);
    $target_user_id = $stmt->fetchColumn();
}

$target_build_refs = isset($data['target_build_refs']) ? json_encode($data['target_build_refs']) : null;
$is_undismissable = isset($data['is_undismissable']) ? (int)$data['is_undismissable'] : 0;

$stmt = $pdo->prepare($sql);
$success = $stmt->execute([
    $target_user_id,
    $target_build_refs,
    $data['heading'],
    $data['emoji'],
    $data['body'],
    $data['button_text'],
    $data['action_type'],
    $data['page_route'] ?? null,
    $data['android_url'] ?? null,
    $data['ios_url'] ?? null,
    $data['is_active'],
    $is_undismissable,
    $data['id']
]);

if ($success) {
    jsonResponse(true, 'Message updated successfully');
} else {
    jsonResponse(false, 'Failed to update message');
}
