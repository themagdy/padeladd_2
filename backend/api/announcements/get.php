<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

$id = intval($data['id'] ?? ($_GET['id'] ?? 0));

if ($id <= 0) {
    jsonResponse(false, 'Invalid announcement ID.');
}

try {
    $stmt = $pdo->prepare("SELECT * FROM announcements WHERE id = ? AND is_visible = 1");
    $stmt->execute([$id]);
    $announcement = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$announcement) {
        jsonResponse(false, 'Announcement not found.');
    }

    jsonResponse(true, 'Announcement details loaded.', ['announcement' => $announcement]);
} catch (\Throwable $e) {
    jsonResponse(false, 'Failed to fetch announcement details.');
}
?>
