<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

try {
    $stmt = $pdo->query("SELECT * FROM announcements ORDER BY created_at DESC");
    $announcements = $stmt->fetchAll(PDO::FETCH_ASSOC);
    jsonResponse(true, 'Announcements list fetched successfully.', ['announcements' => $announcements]);
} catch (\Throwable $e) {
    jsonResponse(false, 'Failed to fetch announcements: ' . $e->getMessage());
}
?>
