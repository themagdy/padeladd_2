<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$data = json_decode(file_get_contents('php://input'), true);
$venueId = $data['id'] ?? null;
$name = trim($data['name'] ?? '');
$location = trim($data['location_link'] ?? '');
$isHidden = isset($data['is_hidden']) ? (int)$data['is_hidden'] : null;

if (!$venueId) {
    jsonResponse(false, 'Venue ID is required.');
}

$pdo = getDB();

try {
    $updates = [];
    $params = [];
    
    if ($name !== '') {
        $updates[] = "name = ?";
        $params[] = $name;
    }
    
    if ($location !== '') {
        $updates[] = "venue_location_link = ?";
        $params[] = $location;
    }
    
    if ($isHidden !== null) {
        $updates[] = "is_hidden = ?";
        $params[] = $isHidden;
    }
    
    if (empty($updates)) {
        jsonResponse(false, 'No changes provided.');
    }
    
    $params[] = $venueId;
    $sql = "UPDATE venues SET " . implode(", ", $updates) . " WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    jsonResponse(true, 'Venue updated successfully.');
    
} catch (Exception $e) {
    jsonResponse(false, 'Error updating venue: ' . $e->getMessage());
}
