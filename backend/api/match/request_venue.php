<?php
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$venue_name = trim($data['venue_name'] ?? '');

if (empty($venue_name)) {
    jsonResponse(false, 'Venue name is required');
}

try {
    $stmt = $pdo->prepare("INSERT INTO venues (name, status, req_by) VALUES (?, 'Requested', ?)");
    $stmt->execute([$venue_name, $uid]);
    $newId = $pdo->lastInsertId();

    jsonResponse(true, 'Venue request submitted successfully', [
        'id' => $newId,
        'name' => $venue_name
    ]);
} catch (PDOException $e) {
    error_log("Venue Request Error: " . $e->getMessage());
    jsonResponse(false, 'Failed to submit venue request', null, 500);
}
