<?php
/**
 * POST /api/admin/system/get_settings
 * Admin authenticated endpoint to fetch all key-value settings.
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

$pdo = getDB();

$stmt = $pdo->prepare("SELECT setting_key, setting_value FROM system_settings");
$stmt->execute();
$settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

// Fallback seed in case DB gets reset/empty
if (!isset($settings['invite_only_mode'])) {
    $stmtInsert = $pdo->prepare("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('invite_only_mode', '1')");
    $stmtInsert->execute();
    $settings['invite_only_mode'] = '1';
}

jsonResponse(true, 'Settings fetched successfully.', $settings);
