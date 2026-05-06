<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

$sql = "
    SELECT m.*, up.nickname as target_name, up.player_code as target_code
    FROM in_app_messages m
    LEFT JOIN user_profiles up ON m.target_user_id = up.user_id
    ORDER BY m.created_at DESC
";

$messages = $pdo->query($sql)->fetchAll();

jsonResponse(true, 'Messages fetched.', $messages);
