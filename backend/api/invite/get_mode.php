<?php
/**
 * POST /api/invite/get_mode
 * Public endpoint to fetch the current invite-only exclusivity status.
 */
require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/response.php';

$pdo = getDB();

$stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'invite_only_mode'");
$stmt->execute();
$val = $stmt->fetchColumn();

$invite_only_mode = ($val === '1');

jsonResponse(true, 'Exclusivity status fetched successfully.', [
    'invite_only_mode' => $invite_only_mode
]);
