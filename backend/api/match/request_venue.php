<?php
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$venue_name = trim($data['venue_name'] ?? '');

if (empty($venue_name)) {
    jsonResponse(false, 'Venue name is required');
}

try {
    $stmt = $pdo->prepare("INSERT INTO venue_requests (user_id, venue_name) VALUES (?, ?)");
    $stmt->execute([$uid, $venue_name]);

    jsonResponse(true, 'Venue request submitted successfully');
} catch (PDOException $e) {
    error_log("Venue Request Error: " . $e->getMessage());
    jsonResponse(false, 'Failed to submit venue request', null, 500);
}
