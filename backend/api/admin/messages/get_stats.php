<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();
$message_id = (int)($_GET['message_id'] ?? 0);

if ($message_id <= 0) {
    jsonResponse(false, 'Invalid Message ID.', null, 422);
}

// 1. Fetch message details
$msgStmt = $pdo->prepare("SELECT * FROM in_app_messages WHERE id = ?");
$msgStmt->execute([$message_id]);
$message = $msgStmt->fetch();

if (!$message) {
    jsonResponse(false, 'Message not found.', null, 404);
}

// 2. Fetch views
$sql = "
    SELECT v.viewed_at, up.nickname, up.player_code, u.first_name, u.last_name
    FROM in_app_message_views v
    JOIN user_profiles up ON v.user_id = up.user_id
    JOIN users u ON v.user_id = u.id
    WHERE v.message_id = ?
    ORDER BY v.viewed_at DESC
";
$stmt = $pdo->prepare($sql);
$stmt->execute([$message_id]);
$views = $stmt->fetchAll();

// 3. Summary stats
$totalPlayers = !empty($message['target_user_id']) 
    ? 1 
    : (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status = 'active'")->fetchColumn();
$seenCount = count($views);

$summary = [
    'message_heading' => $message['heading'],
    'target_user_id' => $message['target_user_id'],
    'seen_count' => $seenCount,
    'total_active_players' => $totalPlayers,
];

jsonResponse(true, 'Stats fetched.', [
    'summary' => $summary,
    'views' => $views
]);
