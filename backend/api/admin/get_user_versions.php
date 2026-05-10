<?php
require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/admin_auth.php';
require_once __DIR__ . '/../../helpers/response.php';

$pdo = getDB();
validateAdmin();

$sql = "
    SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.last_build_ref, 
        u.updated_at as last_activity,
        up.player_code,
        up.nickname,
        up.profile_image_thumb
    FROM users u
    JOIN user_profiles up ON u.id = up.user_id
    WHERE u.status = 'active'
    ORDER BY u.last_build_ref DESC, u.updated_at DESC
";

$stmt = $pdo->query($sql);
$users = $stmt->fetchAll();

jsonResponse(true, 'User versions loaded.', $users);
?>
