<?php
/**
 * POST /api/match/cancel
 * Phase 4: Creator cancels a match entirely.
 * Also handles legacy waiting-list pending request cancellation (via waiting_list_id).
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = (int)$user['id'];

$match_id = isset($data['match_id'])        ? (int)$data['match_id']        : 0;
$wl_id    = isset($data['waiting_list_id']) ? (int)$data['waiting_list_id'] : 0;
$reason   = isset($data['reason'])          ? trim($data['reason'])          : null;

// ── CASE 1: Legacy waiting-list pending cancellation ──────────────────────
if ($wl_id > 0 && $match_id === 0) {
    $wlStmt = $pdo->prepare("
        SELECT id, match_id, partner_id, request_status FROM waiting_list
        WHERE id = ? AND requester_id = ? AND request_status = 'pending'
    ");
    $wlStmt->execute([$wl_id, $uid]);
    $wl = $wlStmt->fetch(PDO::FETCH_ASSOC);

    if (!$wl) {
        jsonResponse(false, 'Pending request not found or you are not the requester.', null, 404);
    }

    $pdo->prepare("UPDATE waiting_list SET request_status = 'cancelled' WHERE id = ?")
        ->execute([$wl_id]);

    // Phase 6: Dismiss the team_invite notification for the partner if it exists
    if ($wl['partner_id']) {
        deleteNotification($pdo, (int)$wl['partner_id'], 'team_invite', (int)$wl['match_id']);
    }

    jsonResponse(true, 'Request cancelled successfully.', null);
}

// ── CASE 2: Full match cancellation by creator ────────────────────────────
if ($match_id <= 0) {
    jsonResponse(false, 'match_id is required.', null, 422);
}

try {
    $pdo->beginTransaction();

    // Lock and fetch match
    $mStmt = $pdo->prepare("SELECT * FROM matches WHERE id = ? FOR UPDATE");
    $mStmt->execute([$match_id]);
    $match = $mStmt->fetch(PDO::FETCH_ASSOC);

    if (!$match) {
        $pdo->rollBack();
        jsonResponse(false, 'Match not found.', null, 404);
    }

    // Only creator can cancel
    if ((int)$match['creator_id'] !== $uid) {
        $pdo->rollBack();
        jsonResponse(false, 'Only the match creator can cancel this match.', null, 403);
    }

    // Only active matches can be cancelled
    if (in_array($match['status'], ['completed', 'cancelled'])) {
        $pdo->rollBack();
        jsonResponse(false, 'This match is already completed or cancelled.', null, 403);
    }

    // Collect affected player IDs for the audit log
    $playersStmt = $pdo->prepare("SELECT user_id FROM match_players WHERE match_id = ?");
    $playersStmt->execute([$match_id]);
    $affectedUsers = array_column($playersStmt->fetchAll(PDO::FETCH_ASSOC), 'user_id');
    $playerCount   = count($affectedUsers);

    // ── 6-hour enforcement ──────────────────────────────────────────────
    $matchTime  = strtotime($match['match_datetime']);
    $now        = time();
    $hoursUntil = ($matchTime - $now) / 3600;
    
    $isLate = ($hoursUntil >= 0 && $hoursUntil < POLICY_VIOLATION_HOURS);

    $eventData = json_encode([
        'hours_until_match' => round($hoursUntil, 2),
        'affected_user_ids' => $affectedUsers,
        'reason'            => $reason,
        'is_late'           => $isLate,
    ]);

    $isFull = ($playerCount >= 4);
    $isViolation = ($isLate && $isFull) ? 1 : 0;

    // Cancel the match
    $pdo->prepare("
        UPDATE matches
        SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = ?, is_policy_violation = ?
        WHERE id = ?
    ")->execute([$reason, $isViolation, $match_id]);

    // IMPORTANT: DO NOT remove players from match_players. 
    // We keep them so the match appears in their Past Matches history.
    
    // Cancel all waiting-list entries
    $pdo->prepare("
        UPDATE waiting_list
        SET request_status = 'cancelled'
        WHERE match_id = ? AND request_status IN ('pending', 'approved')
    ")->execute([$match_id]);

    // Audit: match_cancelled event
    $pdo->prepare("
        INSERT INTO match_events (match_id, user_id, event_type, event_data)
        VALUES (?, ?, 'match_cancelled', ?)
    ")->execute([$match_id, $uid, $eventData]);

    // Audit: late_cancellation event
    if ($isLate) {
        $pdo->prepare("
            INSERT INTO match_events (match_id, user_id, event_type, event_data)
            VALUES (?, ?, 'late_cancellation', ?)
        ")->execute([$match_id, $uid, $eventData]);
    }

    // Cleanup: Remove all stale 'team_invite' and 'phone_requested' notifications for this match
    $pdo->prepare("DELETE FROM notifications WHERE reference_id = ? AND type IN ('team_invite', 'phone_requested')")
        ->execute([$match_id]);

    $pdo->commit();

    // Phase 6: Notify all confirmed players that the match was cancelled
    $matchDate  = date('D j M', strtotime($match['match_datetime']));
    $matchTime  = date('g:i A', strtotime($match['match_datetime']));
    foreach ($affectedUsers as $affectedUid) {
        if ((int)$affectedUid === $uid) continue; // Don't notify the canceller
        createNotification($pdo, (int)$affectedUid, 'match_cancelled', $match_id, "Match on {$matchDate} at {$matchTime} was cancelled", $uid);
    }

    $message = 'Match has been cancelled.';
    if ($isLate) {
        $message .= ' Note: This is a late cancellation (within ' . POLICY_VIOLATION_HOURS . ' hours of the match).';
    }

    jsonResponse(true, $message, [
        'is_late'  => $isLate,
        'affected' => $affectedUsers,
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(false, 'Cancellation failed: ' . $e->getMessage(), null, 500);
}
