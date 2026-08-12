<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Method not allowed.', null, 405);
}

$data = json_decode(file_get_contents('php://input'), true);
$venueId = $data['id'] ?? null;

if (!$venueId) {
    jsonResponse(false, 'Venue ID is required.');
}

$pdo = getDB();

try {
    // Delete the venue
    $stmt = $pdo->prepare("DELETE FROM venues WHERE id = ?");
    $stmt->execute([$venueId]);
    
    jsonResponse(true, 'Venue deleted successfully.');
} catch (Exception $e) {
    jsonResponse(false, 'Error deleting venue: ' . $e->getMessage());
}
