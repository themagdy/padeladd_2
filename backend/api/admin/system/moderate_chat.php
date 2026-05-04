<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$input = json_decode(file_get_contents('php://input'), true);
$chatId = $input['chat_id'] ?? null;
$hide = isset($input['hide']) ? (int)$input['hide'] : 0;

if (!$chatId) {
    jsonResponse(false, 'Chat ID required.', null, 400);
}

$pdo = getDB();

try {
    $stmt = $pdo->prepare("UPDATE chat_messages SET is_hidden = ? WHERE id = ?");
    $stmt->execute([$hide, $chatId]);
    
    jsonResponse(true, $hide ? 'Message hidden from public chat.' : 'Message restored to public chat.');
} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
}
