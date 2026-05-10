<?php
require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/admin_auth.php';
require_once __DIR__ . '/../../helpers/response.php';

$pdo = getDB();
validateAdmin();

$sql = "SELECT DISTINCT last_build_ref FROM users WHERE last_build_ref IS NOT NULL AND last_build_ref != '' ORDER BY last_build_ref DESC";
$stmt = $pdo->query($sql);
$builds = $stmt->fetchAll(PDO::FETCH_COLUMN);

jsonResponse(true, 'Builds loaded.', $builds);
?>
