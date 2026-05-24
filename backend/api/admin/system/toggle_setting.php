<?php
/**
 * POST /api/admin/system/toggle_setting
 * Admin authenticated endpoint to toggle a setting value between '1' and '0'.
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

$pdo = getDB();

$data = json_decode(file_get_contents('php://input'), true);
$key = trim($data['setting_key'] ?? '');

if (empty($key)) {
    jsonResponse(false, 'setting_key is required.', null, 422);
}

$stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ?");
$stmt->execute([$key]);
$current = $stmt->fetchColumn();

if ($current === false) {
    jsonResponse(false, 'Setting key not found.', null, 404);
}

$newValue = ($current === '1') ? '0' : '1';

$updateStmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = ?");
$updateStmt->execute([$newValue, $key]);

jsonResponse(true, 'Setting updated successfully.', [
    'setting_key' => $key,
    'setting_value' => $newValue
]);
