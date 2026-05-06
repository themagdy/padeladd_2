<?php
require_once __DIR__ . '/../../../../core/db.php';
require_once __DIR__ . '/../../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();
$data = json_decode(file_get_contents('php://input'), true);

$id = (int)($data['id'] ?? 0);

if ($id <= 0) {
    jsonResponse(false, 'Invalid ID.', null, 422);
}

try {
    $stmt = $pdo->prepare("DELETE FROM in_app_messages WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(true, 'Message deleted.');
} catch (Exception $e) {
    jsonResponse(false, 'Failed to delete message: ' . $e->getMessage(), null, 500);
}
