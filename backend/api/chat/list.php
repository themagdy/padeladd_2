<?php
/**
 * POST /api/chat/list
 * Phase 5: List messages for a match chat.
 * Supports incremental polling via optional 'since_id'.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = (int)$user['id'];

$match_id = (int)($data['match_id'] ?? 0);
$since_id = (int)($data['since_id'] ?? 0);

if ($match_id <= 0) {
    jsonResponse(false, 'match_id is required.', null, 422);
}

// Ensure presence and read status tables exist
$pdo->exec('CREATE TABLE IF NOT EXISTS chat_presence (
    user_id INT,
    match_id INT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, match_id)
)');

$pdo->exec('CREATE TABLE IF NOT EXISTS chat_read_status (
    user_id INT,
    match_id INT,
    last_read_id INT DEFAULT 0,
    PRIMARY KEY (user_id, match_id)
)');

$hStmt = $pdo->prepare("INSERT INTO chat_presence (user_id, match_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_seen = NOW()");
$hStmt->execute([$uid, $match_id]);

// Update read status to latest message in this match
$maxMsgStmt = $pdo->prepare("SELECT MAX(id) FROM chat_messages WHERE match_id = ?");
$maxMsgStmt->execute([$match_id]);
$maxId = (int)$maxMsgStmt->fetchColumn();

if ($maxId > 0) {
    $rStmt = $pdo->prepare("INSERT INTO chat_read_status (user_id, match_id, last_read_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE last_read_id = GREATEST(last_read_id, VALUES(last_read_id))");
    $rStmt->execute([$uid, $match_id, $maxId]);
}

// Verify match exists
$mStmt = $pdo->prepare("SELECT id, status, match_datetime FROM matches WHERE id = ?");
$mStmt->execute([$match_id]);
$match = $mStmt->fetch(PDO::FETCH_ASSOC);
if (!$match) {
    jsonResponse(false, 'Match not found.', null, 404);
}

// Check access: must be a confirmed player, in the waiting list, OR the match is in the past/cancelled
$isPast = strtotime($match['match_datetime']) <= time();
$isCancelled = ($match['status'] === 'cancelled');

if (!$isPast && !$isCancelled) {
    $accessStmt = $pdo->prepare("
        SELECT 1 FROM match_players WHERE match_id = ? AND user_id = ? AND status = 'confirmed'
        UNION
        SELECT 1 FROM waiting_list WHERE match_id = ? AND (requester_id = ? OR partner_id = ?) AND request_status IN ('pending', 'approved')
        LIMIT 1
    ");
    $accessStmt->execute([$match_id, $uid, $match_id, $uid, $uid]);
    if (!$accessStmt->fetch()) {
        jsonResponse(false, 'You are not a member of this match.', null, 403);
    }
}

// Fetch messages - optionally only newer than since_id
$query = "
    SELECT cm.id, cm.match_id, cm.user_id, cm.message_text, cm.created_at,
           u.first_name, u.last_name,
           up.nickname, up.player_code, up.profile_image, up.profile_image_thumb
    FROM chat_messages cm
    JOIN users u ON cm.user_id = u.id
    LEFT JOIN user_profiles up ON cm.user_id = up.user_id
    WHERE cm.match_id = ?
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

// Fetch pending phone requests directed at the current user in this match
$prStmt = $pdo->prepare("
    SELECT pr.id, pr.requester_id, pr.status, pr.created_at, pr.updated_at,
           u.first_name, u.last_name, up.nickname, up.player_code
    FROM phone_requests pr
    JOIN users u ON pr.requester_id = u.id
    LEFT JOIN user_profiles up ON pr.requester_id = up.user_id
    WHERE pr.match_id = ? AND pr.target_user_id = ? AND pr.status = 'pending'
");
$prStmt->execute([$match_id, $uid]);
$pendingPhoneRequests = $prStmt->fetchAll(PDO::FETCH_ASSOC);

// Fetch outgoing phone request statuses for the current user in this match
$outStmt = $pdo->prepare("
    SELECT pr.id, pr.target_user_id, pr.status, pr.created_at, pr.updated_at,
           u.first_name, u.last_name, u.mobile as phone,
           up.nickname, up.player_code, up.profile_image, up.profile_image_thumb
    FROM phone_requests pr
    JOIN users u ON pr.target_user_id = u.id
    LEFT JOIN user_profiles up ON pr.target_user_id = up.user_id
    WHERE pr.match_id = ? AND pr.requester_id = ?
");
$outStmt->execute([$match_id, $uid]);
$outgoingPhoneRequests = $outStmt->fetchAll(PDO::FETCH_ASSOC);

// Mask phone number if not approved
foreach ($outgoingPhoneRequests as &$opr) {
    if ($opr['status'] !== 'approved') {
        $opr['phone'] = null;
    }
}
unset($opr);

// Fetch actively online users within the last 15 seconds for this specific match
$presStmt = $pdo->prepare("
    SELECT user_id 
    FROM chat_presence
    WHERE match_id = ? AND last_seen >= NOW() - INTERVAL 15 SECOND
      AND user_id IN (
          SELECT user_id FROM match_players WHERE match_id = ?
          UNION
          SELECT requester_id FROM waiting_list WHERE match_id = ?
          UNION
          SELECT partner_id FROM waiting_list WHERE match_id = ? AND partner_id IS NOT NULL
      )
");
$presStmt->execute([$match_id, $match_id, $match_id, $match_id]);
$online_users = $presStmt->fetchAll(PDO::FETCH_COLUMN);

jsonResponse(true, 'Messages loaded.', [
    'messages'               => $messages,
    'viewer_id'              => $uid,
    'pending_phone_requests' => $pendingPhoneRequests,
    'outgoing_phone_requests'=> $outgoingPhoneRequests,
    'online_users'           => $online_users,
]);

