<?php
require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/auth_helper.php';

// Auth check
$user = Auth::getAuthenticatedUser();
if (!$user) {
    jsonResponse(false, 'Unauthorized');
}

$data = json_decode(file_get_contents('php://input'), true);
$reportText = trim($data['report_text'] ?? '');

if (empty($reportText)) {
    jsonResponse(false, 'Please describe the problem.');
}

try {
    $pdo = getDB();
    $stmt = $pdo->prepare("INSERT INTO system_reports (user_id, report_text) VALUES (?, ?)");
    $stmt->execute([$user['id'], $reportText]);

    jsonResponse(true, 'Report submitted successfully. Thank you for your feedback!');
} catch (Exception $e) {
    error_log("System report error: " . $e->getMessage());
    jsonResponse(false, 'Failed to submit report. Please try again later.');
}
?>
