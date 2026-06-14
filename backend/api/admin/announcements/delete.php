<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

// We get the payload. Note that DELETE may come in JSON or POST/GET depending on frontend implementation.
// To support both, let's parse raw input or POST
$input = json_decode(file_get_contents('php://input'), true);
$id = intval($input['id'] ?? ($_POST['id'] ?? ($_GET['id'] ?? 0)));

if ($id <= 0) {
    jsonResponse(false, 'Invalid announcement ID.');
}

try {
    // Select to find the image file path
    $stmt = $pdo->prepare("SELECT image_url FROM announcements WHERE id = ?");
    $stmt->execute([$id]);
    $announcement = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$announcement) {
        jsonResponse(false, 'Announcement not found.');
    }

    // Delete image file from filesystem
    $filePath = __DIR__ . '/../../../../' . $announcement['image_url'];
    if (file_exists($filePath) && is_file($filePath)) {
        @unlink($filePath);
    }

    // Delete database row
    $stmtDel = $pdo->prepare("DELETE FROM announcements WHERE id = ?");
    $stmtDel->execute([$id]);

    jsonResponse(true, 'Announcement deleted successfully.');
} catch (\Throwable $e) {
    jsonResponse(false, 'Failed to delete announcement: ' . $e->getMessage());
}
?>
