<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

$data = json_decode(file_get_contents('php://input'), true);
$report_id = (int)($data['report_id'] ?? 0);
$action = $data['action'] ?? ''; // 'resolve' or 'delete'

if ($report_id <= 0 || !in_array($action, ['resolve', 'delete'])) {
    jsonResponse(false, 'Invalid request parameters.');
}

if ($action === 'resolve') {
    $stmt = $pdo->prepare("UPDATE system_reports SET status = 'resolved' WHERE id = ?");
    $stmt->execute([$report_id]);
    jsonResponse(true, 'Report marked as resolved.');
} else {
    $stmt = $pdo->prepare("DELETE FROM system_reports WHERE id = ?");
    $stmt->execute([$report_id]);
    jsonResponse(true, 'Report deleted.');
}
?>
