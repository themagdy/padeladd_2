<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

$sql = "
    SELECT vr.*, u.nickname as requester_name, u.player_code as requester_code
    FROM venue_requests vr
    LEFT JOIN user_profiles u ON vr.user_id = u.user_id
    WHERE vr.status = 'pending'
    ORDER BY vr.created_at ASC
";

$requests = $pdo->query($sql)->fetchAll();

jsonResponse(true, 'Venue requests fetched.', ['requests' => $requests]);
