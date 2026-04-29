<?php
require_once __DIR__ . '/../../core/app.php';

// Ensure user is logged in
$uid = Auth::getUserId();
if (!$uid) {
    Response::json(false, 'Unauthorized', null, 401);
}

$data = Request::json();
$venue_name = trim($data['venue_name'] ?? '');

if (empty($venue_name)) {
    Response::json(false, 'Venue name is required');
}

try {
    $pdo = getDB();
    $stmt = $pdo->prepare("INSERT INTO venue_requests (user_id, venue_name) VALUES (?, ?)");
    $stmt->execute([$uid, $venue_name]);

    Response::json(true, 'Venue request submitted successfully');
} catch (PDOException $e) {
    error_log("Venue Request Error: " . $e->getMessage());
    Response::json(false, 'Failed to submit venue request');
}
