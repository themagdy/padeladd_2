<?php
/**
 * POST /api/admin/system/update_report_status
 * Admin update for system report status (pending/resolved).
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();
$data = json_decode(file_get_contents('php://input'), true);

$report_id = (int)($data['id'] ?? 0);
$status = $data['status'] ?? ''; // 'pending' or 'resolved'

if ($report_id <= 0 || !in_array($status, ['pending', 'resolved'])) {
    jsonResponse(false, 'Invalid request parameters.', null, 422);
}

try {
    $stmt = $pdo->prepare("UPDATE system_reports SET status = ? WHERE id = ?");
    $stmt->execute([$status, $report_id]);

    jsonResponse(true, "Report status updated to {$status}.");
} catch (Exception $e) {
    jsonResponse(false, 'Failed to update status: ' . $e->getMessage(), null, 500);
}
