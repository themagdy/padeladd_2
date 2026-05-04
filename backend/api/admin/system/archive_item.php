<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();
$data = json_decode(file_get_contents('php://input'), true);

$id = (int)($data['id'] ?? 0);
$type = $data['type'] ?? ''; // 'match_report', 'profile_report', 'violation'
$status = (int)($data['status'] ?? 1); // 1 for archived, 0 for unarchived

if ($id <= 0 || !in_array($type, ['match_report', 'profile_report', 'violation'])) {
    jsonResponse(false, 'Invalid parameters.', null, 400);
}

$table = '';
if ($type === 'match_report') $table = 'match_reports';
if ($type === 'profile_report') $table = 'profile_reports';
if ($type === 'violation') $table = 'match_events';

try {
    $stmt = $pdo->prepare("UPDATE $table SET is_archived = ? WHERE id = ?");
    $stmt->execute([$status, $id]);
    
    jsonResponse(true, 'Item updated successfully.', ['id' => $id, 'status' => $status]);
} catch (Exception $e) {
    jsonResponse(false, 'Update failed: ' . $e->getMessage(), null, 500);
}
