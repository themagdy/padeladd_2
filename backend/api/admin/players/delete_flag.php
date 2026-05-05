<?php
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';

header('Content-Type: application/json');

// Validate admin session
validateAdmin();

$pdo = getDB();

$input = json_decode(file_get_contents('php://input'), true);
$flagId = $input['flag_id'] ?? null;

if (!$flagId) {
    jsonResponse(false, 'Flag ID is required.');
}

try {
    $stmt = $pdo->prepare("DELETE FROM player_flags WHERE id = ?");
    $stmt->execute([$flagId]);

    if ($stmt->rowCount() > 0) {
        jsonResponse(true, 'Flag deleted successfully.');
    } else {
        jsonResponse(false, 'Flag not found or already deleted.');
    }
} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage());
}
?>
