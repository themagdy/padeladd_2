<?php
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/auth_helper.php';

header('Content-Type: application/json');

$pdo = getDB();
$admin = getAuthenticatedUser($pdo);

// Verify admin status
if ($admin['role'] !== 'admin' && $admin['role'] !== 'moderator') {
    jsonResponse(false, 'Unauthorized. Admin access required.', null, 403);
}

try {
    $stmt = $pdo->prepare("
        SELECT 
            f.id, 
            f.flag_type, 
            f.reason, 
            f.created_at,
            u.first_name, 
            u.last_name,
            up.player_code,
            up.nickname,
            adm.first_name as admin_name
        FROM player_flags f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        JOIN users adm ON f.admin_id = adm.id
        ORDER BY f.created_at DESC
    ");
    $stmt->execute();
    $flags = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, 'Flags fetched successfully.', ['flags' => $flags]);
} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage());
}
?>
