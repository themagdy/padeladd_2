<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();
$data = json_decode(file_get_contents('php://input'), true);

$id = (int)($data['id'] ?? 0);
$type = $data['type'] ?? '';

if ($id <= 0 || !in_array($type, ['match_report', 'profile_report', 'score_dispute', 'system_report'])) {
    jsonResponse(false, 'Invalid parameters.', null, 400);
}

$table = '';
if ($type === 'match_report') $table = 'match_reports';
if ($type === 'profile_report') $table = 'profile_reports';
if ($type === 'score_dispute') $table = 'disputes';
if ($type === 'system_report') $table = 'system_reports';

try {
    $stmt = $pdo->prepare("DELETE FROM $table WHERE id = ?");
    $stmt->execute([$id]);
    
    jsonResponse(true, 'Item deleted permanently.', ['id' => $id]);
} catch (Exception $e) {
    jsonResponse(false, 'Deletion failed: ' . $e->getMessage(), null, 500);
}
