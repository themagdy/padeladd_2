<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

$sql = "
    SELECT *
    FROM venues
    ORDER BY name ASC
";

$venues = $pdo->query($sql)->fetchAll();

jsonResponse(true, 'Venues fetched.', ['venues' => $venues]);
