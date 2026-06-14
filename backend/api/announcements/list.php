<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

try {
    $stmt = $pdo->query("SELECT id, title, image_url, created_at FROM announcements WHERE is_visible = 1 ORDER BY created_at DESC");
    $announcements = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, 'Announcements fetched successfully.', ['announcements' => $announcements]);
} catch (\Throwable $e) {
    jsonResponse(false, 'Failed to fetch announcements.');
}
?>
