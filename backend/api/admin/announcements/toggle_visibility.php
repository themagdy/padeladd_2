<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

$input = json_decode(file_get_contents('php://input'), true);
$id = intval($input['id'] ?? ($_POST['id'] ?? ($_GET['id'] ?? 0)));

if ($id <= 0) {
    jsonResponse(false, 'Invalid announcement ID.');
}

try {
    // Check current state
    $stmt = $pdo->prepare("SELECT is_visible FROM announcements WHERE id = ?");
    $stmt->execute([$id]);
    $announcement = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$announcement) {
        jsonResponse(false, 'Announcement not found.');
    }

    $newStatus = $announcement['is_visible'] ? 0 : 1;

    $stmtUpdate = $pdo->prepare("UPDATE announcements SET is_visible = ? WHERE id = ?");
    $stmtUpdate->execute([$newStatus, $id]);

    jsonResponse(true, 'Announcement visibility updated successfully.', [
        'is_visible' => $newStatus
    ]);
} catch (\Throwable $e) {
    jsonResponse(false, 'Failed to toggle visibility: ' . $e->getMessage());
}
?>
