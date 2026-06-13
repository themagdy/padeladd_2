<?php
/**
 * POST /api/admin/matches/chat_list
 * Admin-only: Fetch chat messages for a match chat.
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Method not allowed.', null, 405);
}

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true) ?: [];

$match_id = (int)($data['match_id'] ?? 0);
$since_id = (int)($data['since_id'] ?? 0);

if ($match_id <= 0) {
    jsonResponse(false, 'match_id is required.', null, 422);
}

$pdo = getDB();
$uid = ADMIN_SYSTEM_USER_ID;

// Verify match exists
$mStmt = $pdo->prepare("SELECT id, status FROM matches WHERE id = ?");
$mStmt->execute([$match_id]);
$match = $mStmt->fetch(PDO::FETCH_ASSOC);
if (!$match) {
    jsonResponse(false, 'Match not found.', null, 404);
}

// Fetch messages - optionally only newer than since_id
$query = "
    SELECT cm.id, cm.match_id, cm.user_id, cm.message_text, cm.created_at,
           u.first_name, u.last_name,
           up.nickname, up.player_code, up.profile_image, up.profile_image_thumb
    FROM chat_messages cm
    JOIN users u ON cm.user_id = u.id
    LEFT JOIN user_profiles up ON cm.user_id = up.user_id
    WHERE cm.match_id = ? AND cm.is_hidden = 0
";
$params = [$match_id];

if ($since_id > 0) {
    $query .= " AND cm.id > ?";
    $params[] = $since_id;
}

$query .= " ORDER BY cm.id ASC LIMIT 100";

$stmt = $pdo->prepare($query);
$stmt->execute($params);
$messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

jsonResponse(true, 'Messages loaded.', [
    'messages'                => $messages,
    'viewer_id'               => $uid,
    'pending_phone_requests'  => [],
    'outgoing_phone_requests' => [],
    'online_users'            => [],
]);
