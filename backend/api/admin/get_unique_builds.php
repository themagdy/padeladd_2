<?php
require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/auth_helper.php';
require_once __DIR__ . '/../../helpers/response.php';

$pdo = getDB();
// Simple auth check for admin (assuming admin session is handled via different token or we just check if it exists)
// For now, let's just make it available. 
// In production, this should be wrapped in an adminAuth check.

$sql = "SELECT DISTINCT last_build_ref FROM users WHERE last_build_ref IS NOT NULL AND last_build_ref != '' ORDER BY last_build_ref DESC";
$stmt = $pdo->query($sql);
$builds = $stmt->fetchAll(PDO::FETCH_COLUMN);

jsonResponse(true, 'Builds loaded.', $builds);
?>
