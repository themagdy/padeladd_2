<?php
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';

header('Content-Type: application/json');

// Validate admin session
validateAdmin();

$pdo = getDB();

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
            up.nickname
        FROM player_flags f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        ORDER BY f.created_at DESC
    ");
    $stmt->execute();
    $flags = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, 'Flags fetched successfully.', ['flags' => $flags]);
} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage());
}
?>
