<?php
/**
 * POST /api/admin/matches/update
 * Admin-only: Update match details (date, time, venue, and court).
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/notification_helper.php';

header('Content-Type: application/json');
validateAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Method not allowed.', null, 405);
}

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true) ?: [];

$match_id = isset($data['match_id']) ? (int)$data['match_id'] : 0;
$match_datetime = isset($data['match_datetime']) ? trim($data['match_datetime']) : '';
$venue_id = isset($data['venue_id']) ? (int)$data['venue_id'] : 0;
$court_name = isset($data['court_name']) ? trim($data['court_name']) : '';

if ($match_id <= 0) {
    jsonResponse(false, 'match_id is required.', null, 422);
}
if ($match_datetime === '') {
    jsonResponse(false, 'Match date and time are required.', null, 422);
}
if ($venue_id <= 0) {
    jsonResponse(false, 'Venue / Club is required.', null, 422);
}

// Normalize datetime formats (e.g. from html datetime-local Y-m-d\TH:i)
$match_datetime = str_replace('T', ' ', $match_datetime);
if (strlen($match_datetime) === 16) {
    $match_datetime .= ':00'; // Append seconds if missing
}

$dt = DateTime::createFromFormat('Y-m-d H:i:s', $match_datetime);
if (!$dt) {
    jsonResponse(false, 'Invalid date/time format. Use Y-m-d H:i:s', null, 422);
}

$pdo = getDB();

try {
    $pdo->beginTransaction();

    // Lock match row
    $mStmt = $pdo->prepare("SELECT * FROM matches WHERE id = ? FOR UPDATE");
    $mStmt->execute([$match_id]);
    $match = $mStmt->fetch(PDO::FETCH_ASSOC);

    if (!$match) {
        throw new Exception('Match not found.');
    }

    if (in_array($match['status'], ['completed', 'cancelled'])) {
        throw new Exception('Cannot update a completed or cancelled match.');
    }

    // Check if venue exists
    $vStmt = $pdo->prepare("SELECT name FROM venues WHERE id = ?");
    $vStmt->execute([$venue_id]);
    $venueName = $vStmt->fetchColumn();
    if (!$venueName) {
        throw new Exception('Selected venue/club does not exist.');
    }

    // Check if datetime actually changed (to trigger notification)
    $timeChanged = (strtotime($match['match_datetime']) !== strtotime($match_datetime));

    // Update match details
    $update = $pdo->prepare("
        UPDATE matches 
        SET match_datetime = ?, venue_id = ?, court_name = ? 
        WHERE id = ?
    ");
    $update->execute([$match_datetime, $venue_id, $court_name, $match_id]);

    // Insert match event
    $admin = $_SESSION['admin'] ?? ['id' => 0];
    $eventData = json_encode([
        'updated_by' => 'admin',
        'admin_id' => $admin['id'],
        'old_datetime' => $match['match_datetime'],
        'new_datetime' => $match_datetime,
        'old_venue_id' => $match['venue_id'],
        'new_venue_id' => $venue_id,
        'old_court' => $match['court_name'],
        'new_court' => $court_name
    ]);
    $pdo->prepare("INSERT INTO match_events (match_id, user_id, event_type, event_data) VALUES (?, " . ADMIN_SYSTEM_USER_ID . ", 'match_updated', ?)")
        ->execute([$match_id, $eventData]);

    $pdo->commit();

    // Send notifications to all confirmed players if time changed
    if ($timeChanged) {
        // Fetch all confirmed players in the match
        $playersStmt = $pdo->prepare("SELECT user_id FROM match_players WHERE match_id = ? AND status = 'confirmed'");
        $playersStmt->execute([$match_id]);
        $playerIds = array_column($playersStmt->fetchAll(PDO::FETCH_ASSOC), 'user_id');

        $formattedTime = date('j M \a\t g:i A', strtotime($match_datetime));
        $notifMsg = "Admin updated match time/details: Scheduled for {$formattedTime} at {$venueName}.";

        foreach ($playerIds as $uid) {
            createNotification($pdo, (int)$uid, 'match_time_changed', $match_id, $notifMsg, 0);
        }
    }

    jsonResponse(true, 'Match details updated successfully.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonResponse(false, $e->getMessage(), null, 500);
}
