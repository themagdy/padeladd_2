<?php
require_once __DIR__ . '/../core/db.php';
require_once __DIR__ . '/auth_helper.php';
require_once __DIR__ . '/response.php';

function validateAdmin() {
    $token = getBearerToken();

    if (!$token) {
        jsonResponse(false, 'Admin unauthorized. Token missing.', null, 401);
    }

    $pdo = getDB();
    $stmt = $pdo->prepare("SELECT id FROM admin_sessions WHERE token = ? AND (created_at IS NULL OR created_at >= NOW() - INTERVAL 24 HOUR)");
    $stmt->execute([$token]);
    
    if (!$stmt->fetch()) {
        jsonResponse(false, 'Admin unauthorized. Invalid token.', null, 401);
    }
    
    return true;
}
