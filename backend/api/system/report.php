<?php
/**
 * POST /api/system/report
 * Save a generic system/app problem report.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = (int)$user['id'];

$reason = trim($data['reason'] ?? '');

if (empty($reason)) {
    jsonResponse(false, 'Please provide a description of the problem.');
}

try {
    $stmt = $pdo->prepare("INSERT INTO system_reports (user_id, reason_text) VALUES (?, ?)");
    $stmt->execute([$uid, $reason]);

    jsonResponse(true, 'Your report has been submitted. Our team will look into it. Thank you!');
} catch (Exception $e) {
    error_log("System report error: " . $e->getMessage());
    jsonResponse(false, 'Failed to submit report. Please try again later.');
}
