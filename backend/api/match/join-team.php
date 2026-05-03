<?php
/**
 * POST /api/match/join-team
 * Current user sends a team join request.
 * The request goes to the waiting list; partner must approve.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$match_id     = (int)($data['match_id'] ?? 0);
$partner_code = strtoupper(trim($data["partner_player_code"] ?? ""));

if ($match_id <= 0) {
    jsonResponse(false, 'match_id is required.', null, 422);
}
if ($partner_code === '') {
    jsonResponse(false, 'partner_player_code is required.', null, 422);
}

// Resolve partner
$ps = $pdo->prepare("SELECT user_id FROM user_profiles WHERE player_code = ?");
$ps->execute([$partner_code]);
$partnerRow = $ps->fetch(PDO::FETCH_ASSOC);
if (!$partnerRow) {
    jsonResponse(false, 'Partner player code not found.', null, 404);
}
$partner_id = (int)$partnerRow['user_id'];
if ($partner_id === $uid) {
    jsonResponse(false, 'You cannot add yourself as a partner.', null, 422);
}

// Check if requester is globally blocked
$blockCheck = $pdo->prepare("
    SELECT id FROM blocked_partner_requests
    WHERE blocked_user_id = ? AND blocked_until > NOW()
    LIMIT 1
");
$blockCheck->execute([$uid]);
if ($blockCheck->fetch()) {
    jsonResponse(false, 'You are currently blocked from sending team requests for 1 month due to repeated blocks.', null, 403);
}

// Check match exists and is not completed/cancelled
$mStmt = $pdo->prepare("SELECT * FROM matches WHERE id = ? AND status IN ('open', 'full')");
$mStmt->execute([$match_id]);
$match = $mStmt->fetch(PDO::FETCH_ASSOC);
if (!$match) {
    jsonResponse(false, 'Match not found or not available.', null, 404);
}
if ($match['match_datetime'] < date('Y-m-d H:i:s')) {
    jsonResponse(false, 'Cannot join a match that has already passed.', null, 422);
}

// Check requester not already in the match
$dupCheck = $pdo->prepare("SELECT id FROM match_players WHERE match_id = ? AND user_id = ?");
$dupCheck->execute([$match_id, $uid]);
if ($dupCheck->fetch()) {
    jsonResponse(false, 'You are already in this match.', null, 409);
}

// Check partner not already in the match
$dupCheck->execute([$match_id, $partner_id]);
if ($dupCheck->fetch()) {
    jsonResponse(false, 'Your partner is already in this match.', null, 409);
}

// Check if requester already has ANY pending invitation for this match
$wlCheck = $pdo->prepare("
    SELECT id FROM waiting_list
    WHERE match_id = ? AND requester_id = ? AND request_status = 'pending'
");
$wlCheck->execute([$match_id, $uid]);
if ($wlCheck->fetch()) {
    jsonResponse(false, 'You already have a pending invitation for this match. Cancel it before inviting someone else.', null, 409);
}

// ── Eligibility range check (both players must be in range) ──────────────
$eligMin = (int)$match['eligible_min'];
$eligMax = (int)$match['eligible_max'];

$ptsStmt = $pdo->prepare("SELECT user_id, (COALESCE(points, 100) + COALESCE(rank_points, 50) - 50) AS effective_points FROM player_stats WHERE user_id IN (?, ?)");
$ptsStmt->execute([$uid, $partner_id]);
$ptsMap = [];
foreach ($ptsStmt->fetchAll(PDO::FETCH_ASSOC) as $r) $ptsMap[(int)$r['user_id']] = (int)$r['effective_points'];
$myPts      = $ptsMap[$uid]        ?? 100;
$partnerPts = $ptsMap[$partner_id] ?? 100;

if ($myPts < $eligMin || $myPts > $eligMax) {
    jsonResponse(false, "You are not eligible for this match. Your points ({$myPts}) must be between {$eligMin} and {$eligMax}.", [
        'eligibility_failed' => true,
        'your_points' => $myPts,
        'eligible_min' => $eligMin,
        'eligible_max' => $eligMax,
    ], 422);
}
if ($partnerPts < $eligMin || $partnerPts > $eligMax) {
    jsonResponse(false, "Your partner is not eligible for this match. Their points ({$partnerPts}) must be between {$eligMin} and {$eligMax}.", [
        'eligibility_failed' => true,
        'partner_points' => $partnerPts,
        'eligible_min' => $eligMin,
        'eligible_max' => $eligMax,
    ], 422);
}


// Check partner has not blocked requester
$blkCheck = $pdo->prepare("
    SELECT block_count FROM blocked_partner_requests
    WHERE blocker_user_id = ? AND blocked_user_id = ?
");
$blkCheck->execute([$partner_id, $uid]);
$blkRow = $blkCheck->fetch(PDO::FETCH_ASSOC);
if ($blkRow && $blkRow['block_count'] >= 3) {
    jsonResponse(false, 'This player has blocked your requests.', null, 403);
}

// (Removed Team 2 availability check to allow waitlisting)

// Insert into waiting list
$ins = $pdo->prepare("
    INSERT INTO waiting_list (match_id, requester_id, partner_id, request_status)
    VALUES (?, ?, ?, 'pending')
");
$ins->execute([$match_id, $uid, $partner_id]);
$wl_id = (int)$pdo->lastInsertId();

// Phase 6: Notify partner that they were invited
$requesterName = getDisplayName($user);
createNotification($pdo, $partner_id, 'team_invite', $match_id, "{$requesterName} invited you to join a match as their partner", $uid);

jsonResponse(true, 'Team join request sent to partner. Waiting for their approval.', [
    'waiting_list_id' => $wl_id
]);
