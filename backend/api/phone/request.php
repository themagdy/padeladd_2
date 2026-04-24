<?php
/**
 * POST /api/phone/request
 * Phase 5: Request another player's phone number within a match.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = (int)$user['id'];

$match_id       = (int)($data['match_id'] ?? 0);
$target_user_id = (int)($data['target_user_id'] ?? 0);

if ($match_id <= 0 || $target_user_id <= 0) {
    jsonResponse(false, 'match_id and target_user_id are required.', null, 422);
}
if ($target_user_id === $uid) {
    jsonResponse(false, 'You cannot request your own phone number.', null, 422);
}

// Verify match exists
$mStmt = $pdo->prepare("SELECT id FROM matches WHERE id = ?");
$mStmt->execute([$match_id]);
if (!$mStmt->fetch()) {
    jsonResponse(false, 'Match not found.', null, 404);
}

// Check requester is in the match or waitlist
$accessStmt = $pdo->prepare("
    SELECT 1 FROM match_players WHERE match_id = ? AND user_id = ? AND status = 'confirmed'
    UNION
    SELECT 1 FROM waiting_list WHERE match_id = ? AND (requester_id = ? OR partner_id = ?) AND request_status IN ('pending','approved')
    LIMIT 1
");
$accessStmt->execute([$match_id, $uid, $match_id, $uid, $uid]);
if (!$accessStmt->fetch()) {
    jsonResponse(false, 'You are not a member of this match.', null, 403);
}

// Check target is also in the match
$targetStmt = $pdo->prepare("
    SELECT 1 FROM match_players WHERE match_id = ? AND user_id = ? AND status = 'confirmed'
    UNION
    SELECT 1 FROM waiting_list WHERE match_id = ? AND (requester_id = ? OR partner_id = ?) AND request_status IN ('pending','approved')
    LIMIT 1
");
$targetStmt->execute([$match_id, $target_user_id, $match_id, $target_user_id, $target_user_id]);
if (!$targetStmt->fetch()) {
    jsonResponse(false, 'Target player is not in this match.', null, 403);
}

try {
    $pdo->exec("ALTER TABLE phone_requests ADD COLUMN deny_count INT DEFAULT 0");
} catch (Exception $e) { /* ignore if already exists */ }

// Check if a request already exists
$existing = $pdo->prepare("SELECT id, status, deny_count FROM phone_requests WHERE requester_id = ? AND target_user_id = ? AND match_id = ?");
$existing->execute([$uid, $target_user_id, $match_id]);
$row = $existing->fetch(PDO::FETCH_ASSOC);

if ($row) {
    if ($row['status'] === 'approved') {
        jsonResponse(true, 'Request already approved.', ['status' => 'approved', 'request_id' => (int)$row['id']]);
    }
    if ($row['status'] === 'pending') {
        jsonResponse(true, 'Request already pending.', ['status' => 'pending', 'request_id' => (int)$row['id']]);
    }
    // If status is 'denied' or 'cancelled', we just continue to check the 3-limit cap based on denies.
    $denies = (int)($row['deny_count'] ?? 0);
    if ($denies >= 3) {
        jsonResponse(false, 'This player has denied your request 3 times. You are permanently blocked from requesting their number.', null, 429);
    }
    
    // Reset to pending, keeping the deny history intact implicitly.
    $upd = $pdo->prepare("UPDATE phone_requests SET status = 'pending', updated_at = NOW() WHERE id = ?");
    $upd->execute([$row['id']]);

    // Phase 6: Notify target that someone wants their number (even on resend)
    $requesterName = getDisplayName($user);
    createNotification($pdo, $target_user_id, 'phone_requested', $match_id, "{$requesterName} wants your phone number", $uid);

    jsonResponse(true, 'Phone number request sent.', ['request_id' => (int)$row['id'], 'status' => 'pending']);
}

// Insert request physically initializing at 0 denies
$ins = $pdo->prepare("INSERT INTO phone_requests (requester_id, target_user_id, match_id, deny_count) VALUES (?, ?, ?, 0)");
$ins->execute([$uid, $target_user_id, $match_id]);
$req_id = (int)$pdo->lastInsertId();

// Phase 6: Notify target that someone wants their number
$requesterName = getDisplayName($user);
createNotification($pdo, $target_user_id, 'phone_requested', $match_id, "{$requesterName} wants your phone number", $uid);

jsonResponse(true, 'Phone number request sent.', ['request_id' => $req_id, 'status' => 'pending']);
