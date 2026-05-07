<?php
/**
 * POST /api/system/report
 * Submit a general system report / problem.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = (int)$user['id'];

$message = trim($data['message'] ?? '');

if (empty($message)) {
    jsonResponse(false, 'Message cannot be empty.');
}

try {
    $stmt = $pdo->prepare("INSERT INTO system_reports (user_id, message) VALUES (?, ?)");
    $stmt->execute([$uid, $message]);
    
    jsonResponse(true, 'Report submitted successfully. Thank you for your feedback!');
} catch (Exception $e) {
    error_log("System report error: " . $e->getMessage());
    jsonResponse(false, 'Failed to submit report.');
}
