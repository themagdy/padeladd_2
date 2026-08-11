<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();
$data = json_decode(file_get_contents('php://input'), true);

$id = (int)($data['id'] ?? 0);

if ($id <= 0) {
    jsonResponse(false, 'Invalid parameters.', null, 400);
}

try {
    // Delete the event log record from match_events
    $stmt = $pdo->prepare("DELETE FROM match_events WHERE id = ?");
    $stmt->execute([$id]);
    
    jsonResponse(true, 'Violation deleted successfully.', ['id' => $id]);
} catch (Exception $e) {
    jsonResponse(false, 'Deletion failed: ' . $e->getMessage(), null, 500);
}
