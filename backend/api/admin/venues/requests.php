<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

$sql = "
    SELECT v.id, v.name as venue_name, v.created_at, u.nickname as requester_name, u.player_code as requester_code
    FROM venues v
    LEFT JOIN user_profiles u ON v.req_by = u.user_id
    WHERE v.status = 'Requested'
    ORDER BY v.created_at ASC
";

$requests = $pdo->query($sql)->fetchAll();

jsonResponse(true, 'Venue requests fetched.', ['requests' => $requests]);
