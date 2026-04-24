<?php
/**
 * POST /api/match/deny
 * Partner denies a waiting-list team request.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$wl_id = (int)($data['waiting_list_id'] ?? 0);
if ($wl_id <= 0) {
    jsonResponse(false, 'waiting_list_id is required.', null, 422);
}

$wlStmt = $pdo->prepare("
    SELECT * FROM waiting_list WHERE id = ? AND partner_id = ? AND request_status = 'pending'
");
$wlStmt->execute([$wl_id, $uid]);
$wl = $wlStmt->fetch(PDO::FETCH_ASSOC);
if (!$wl) {
    jsonResponse(false, 'Request not found or you are not the partner.', null, 404);
}

    $pdo->prepare("UPDATE waiting_list SET request_status = 'denied' WHERE id = ?")->execute([$wl_id]);

    // Check if this was a Team 1 partner match creation invite
    $mStmt = $pdo->prepare("SELECT * FROM matches WHERE id = ?");
    $mStmt->execute([(int)$wl['match_id']]);
    $match = $mStmt->fetch(PDO::FETCH_ASSOC);

    if ($match && $match['status'] === 'on_hold' && (int)$match['creator_id'] === (int)$wl['requester_id']) {
        // Partner denied the initial invite, so publish the match as open and drop the partner requirement
        $pdo->prepare("UPDATE matches SET status = 'open', created_with_partner = 0 WHERE id = ?")->execute([$match['id']]);
    }

    // Phase 6: Notify requester that their team invite was declined
    $denierName = getDisplayName($user);
    createNotification($pdo, (int)$wl['requester_id'], 'partner_denied', (int)$wl['match_id'], "{$denierName} declined your team invite", $uid);

    // Cleanup: Remove the team_invite notification for the partner who just denied it
    deleteNotification($pdo, (int)$uid, 'team_invite', (int)$wl['match_id']);

jsonResponse(true, 'Request denied.', null);
