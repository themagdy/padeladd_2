<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Method not allowed.', null, 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$requestId = $input['request_id'] ?? null;
$action = $input['action'] ?? ''; // 'approve' or 'reject'

if (!$requestId) {
    jsonResponse(false, 'Request ID required.', null, 400);
}

$pdo = getDB();

try {
    if ($action === 'reject') {
        $stmt = $pdo->prepare("DELETE FROM venues WHERE id = ?");
        $stmt->execute([$requestId]);
        jsonResponse(true, 'Venue request rejected.');
    } 
    else if ($action === 'approve') {
        $finalName = $input['name'] ?? '';
        $location = $input['location_link'] ?? '';

        if (empty($finalName)) jsonResponse(false, 'Venue name cannot be empty.', null, 400);

        // 1. Update the existing venue to Approved status
        $stmt = $pdo->prepare("UPDATE venues SET name = ?, venue_location_link = ?, status = 'Approved' WHERE id = ?");
        $stmt->execute([$finalName, $location, $requestId]);

        jsonResponse(true, 'Venue approved and added to the official list.');
    } 
    else {
        jsonResponse(false, 'Invalid action.', null, 400);
    }
} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
}
