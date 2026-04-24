<?php
/**
 * POST /api/chat/heartbeat
 * Keeps user online globally or locally.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = (int)$user['id'];

$stmt = $pdo->prepare('INSERT INTO user_presence (user_id) VALUES (?) ON DUPLICATE KEY UPDATE last_seen = NOW()');
$stmt->execute([$uid]);

jsonResponse(true, 'Heartbeat recorded.', ['timestamp' => time()]);
?>
