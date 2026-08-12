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
$name = trim($data['name'] ?? '');
$location = trim($data['location_link'] ?? '');

if (empty($name)) {
    jsonResponse(false, 'Club name is required.');
}

$pdo = getDB();

try {
    $stmt = $pdo->prepare("INSERT INTO venues (name, venue_location_link, status) VALUES (?, ?, 'Added')");
    $stmt->execute([$name, $location]);
    
    jsonResponse(true, 'Venue created successfully.');
} catch (Exception $e) {
    jsonResponse(false, 'Error creating venue: ' . $e->getMessage());
}
