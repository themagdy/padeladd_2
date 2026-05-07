<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();
$reportId = (int)($data['id'] ?? 0);

if (!$reportId) {
    jsonResponse(false, 'Invalid report ID.');
}

try {
    $stmt = $pdo->prepare("UPDATE system_reports SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([$reportId]);
    
    jsonResponse(true, 'System report marked as resolved.');
} catch (Exception $e) {
    jsonResponse(false, 'Failed to resolve report.');
}
