<?php
/**
 * POST /api/match/withdraw
 * Phase 4: Withdraw from a confirmed match slot (solo or team).
 * Also handles waiting-list cancellation (legacy behaviour, via waiting_list_id).
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = (int)$user['id'];

$match_id  = isset($data['match_id'])        ? (int)$data['match_id']        : 0;
$wl_id     = isset($data['waiting_list_id']) ? (int)$data['waiting_list_id'] : 0;
$reason    = isset($data['reason'])          ? trim($data['reason'])          : null;

// ── CASE 1: Waiting-list withdrawal (legacy) ──────────────────────────────
if ($wl_id > 0 && $match_id === 0) {
    $wlStmt = $pdo->prepare("
        SELECT id, match_id, requester_id, partner_id, request_status
        FROM waiting_list
        WHERE id = ? AND (requester_id = ? OR partner_id = ?)
    ");
    $wlStmt->execute([$wl_id, $uid, $uid]);
    $wl = $wlStmt->fetch(PDO::FETCH_ASSOC);

    if (!$wl) {
        jsonResponse(false, 'Waitlist entry not found or you are not authorized.', null, 404);
    }
    if (in_array($wl['request_status'], ['cancelled', 'denied', 'joined'])) {
        jsonResponse(false, 'Request is already in a final state.', null, 403);
    }

    try {
        $pdo->beginTransaction();

        $pdo->prepare("UPDATE waiting_list SET request_status = 'cancelled' WHERE id = ?")
            ->execute([$wl_id]);

        // Check if this was an 'on_hold' match and the requester (creator) is cancelling the invite
        $mStmt = $pdo->prepare("SELECT id, status, creator_id FROM matches WHERE id = ? FOR UPDATE");
        $mStmt->execute([(int)$wl['match_id']]);
        $match = $mStmt->fetch(PDO::FETCH_ASSOC);

        if ($match && $match['status'] === 'on_hold') {
            // Publish the match
            $pdo->prepare("UPDATE matches SET status = 'open', created_with_partner = 0 WHERE id = ?")
                ->execute([$match['id']]);
        }

        // Phase 6: Remove the invite notification for the partner
        if (!empty($wl['partner_id'])) {
            // Note: we use match_id as the reference_id for team_invite notifications
            deleteNotification($pdo, (int)$wl['partner_id'], 'team_invite', (int)$wl['match_id']);
        }

        $pdo->commit();
        jsonResponse(true, 'Invitation cancelled and match published.', null);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonResponse(false, 'Failed to cancel invitation: ' . $e->getMessage(), null, 500);
    }
}


// ── CASE 2: Confirmed match slot withdrawal ───────────────────────────────
if ($match_id <= 0) {
    jsonResponse(false, 'match_id is required.', null, 422);
}

try {
    $pdo->beginTransaction();

    // Lock match row
    $mStmt = $pdo->prepare("SELECT * FROM matches WHERE id = ? FOR UPDATE");
    $mStmt->execute([$match_id]);
    $match = $mStmt->fetch(PDO::FETCH_ASSOC);

    if (!$match) {
        $pdo->rollBack();
        jsonResponse(false, 'Match not found.', null, 404);
    }

    if (in_array($match['status'], ['completed', 'cancelled'])) {
        $pdo->rollBack();
        jsonResponse(false, 'Cannot withdraw from a completed or cancelled match.', null, 403);
    }

    if ((int)$match['creator_id'] === $uid) {
        $pdo->rollBack();
        jsonResponse(false, 'Creators cannot leave their own match. Please cancel the match instead.', null, 403);
    }

    // ── 6-hour enforcement (Removed hard block, now only used for audit) ──
    $matchTime  = strtotime($match['match_datetime']);
    $now        = time();
    $hoursUntil = ($matchTime - $now) / 3600;
    $isLate     = ($hoursUntil >= 0 && $hoursUntil < 6);

    // Fetch THIS player's slot
    $slotStmt = $pdo->prepare("
        SELECT mp.*, up.nickname
        FROM match_players mp
        LEFT JOIN user_profiles up ON up.user_id = mp.user_id
        WHERE mp.match_id = ? AND mp.user_id = ?
    ");
    $slotStmt->execute([$match_id, $uid]);
    $mySlot = $slotStmt->fetch(PDO::FETCH_ASSOC);

    if (!$mySlot) {
        $pdo->rollBack();
        jsonResponse(false, 'You are not in this match.', null, 404);
    }

    // Determine if it is a team withdrawal (both players in same team joined as 'team')
    $isTeamJoin   = ($mySlot['join_type'] === 'team');
    $affectedUsers = [$uid];
    $displacedPartnerId = 0;

    if ($isTeamJoin) {
        // Find team partner (same match, same team, also join_type='team', different user)
        $partnerStmt = $pdo->prepare("
            SELECT user_id FROM match_players
            WHERE match_id = ? AND team_no = ? AND join_type = 'team' AND user_id != ?
        ");
        $partnerStmt->execute([$match_id, $mySlot['team_no'], $uid]);
        $partner = $partnerStmt->fetch(PDO::FETCH_ASSOC);
        if ($partner) {
            $displacedPartnerId = (int)$partner['user_id'];
            $affectedUsers[]    = $displacedPartnerId;
        }
    }

    // Remove slots
    $placeholders = implode(',', array_fill(0, count($affectedUsers), '?'));
    $pdo->prepare("DELETE FROM match_players WHERE match_id = ? AND user_id IN ($placeholders)")
        ->execute(array_merge([$match_id], $affectedUsers));

    // Also cancel any waiting-list entries for affected users in this match
    $pdo->prepare("
        UPDATE waiting_list
        SET request_status = 'cancelled'
        WHERE match_id = ? AND request_status IN ('pending','approved','joined')
          AND (requester_id IN ($placeholders) OR partner_id IN ($placeholders))
    ")->execute(array_merge([$match_id], $affectedUsers, $affectedUsers));

    // Phase 6: Clear all notifications related to this match for the affected users
    $placeholdersNotif = implode(',', array_fill(0, count($affectedUsers), '?'));
    $pdo->prepare("DELETE FROM notifications WHERE reference_id = ? AND user_id IN ($placeholdersNotif)")
        ->execute(array_merge([$match_id], $affectedUsers));

    // Revert match status to 'open' if it was 'full'
    if ($match['status'] === 'full') {
        $pdo->prepare("UPDATE matches SET status = 'open' WHERE id = ?")
            ->execute([$match_id]);
    }

    // ── Audit log ───────────────────────────────────────────────────────
    $eventType = $isTeamJoin ? 'team_withdrawn' : 'player_withdrawn';

    $eventData = json_encode([
        'hours_until_match' => round($hoursUntil, 2),
        'affected_user_ids' => $affectedUsers,
        'is_late'           => $isLate,
        'reason'            => $reason,
    ]);

    // Always log the withdrawal event
    $pdo->prepare("
        INSERT INTO match_events (match_id, user_id, event_type, event_data)
        VALUES (?, ?, ?, ?)
    ")->execute([$match_id, $uid, $eventType, $eventData]);

    // If late, log additional late_withdrawal event
    if ($isLate) {
        $pdo->prepare("
            INSERT INTO match_events (match_id, user_id, event_type, event_data)
            VALUES (?, ?, 'late_withdrawal', ?)
        ")->execute([$match_id, $uid, $eventData]);
    }


    $pdo->commit();

    // Phase 6: Notify remaining match participants that someone withdrew
    $withdrawerName = getDisplayName($user);
    $notifMsg = $isTeamJoin 
        ? "{$withdrawerName} and their partner withdrew from the match" 
        : "{$withdrawerName} withdrew from the match";
    notifyMatchParticipants($pdo, $match_id, 'player_withdrawn', $notifMsg, $uid);

    // Phase 6: Notify the partner who was displaced by this withdrawal (if any)
    if ($displacedPartnerId > 0) {
        createNotification($pdo, $displacedPartnerId, 'player_withdrawn', $match_id, "{$withdrawerName} withdrew, so you've been removed from the match too", $uid);
    }

    // Phase 6: Notify waitlist about new availability
    $checkStmt = $pdo->prepare("SELECT team_no, slot_no FROM match_players WHERE match_id = ?");
    $checkStmt->execute([$match_id]);
    $currentPlayers = $checkStmt->fetchAll(PDO::FETCH_ASSOC);
    $occupied = [];
    foreach ($currentPlayers as $cp) {
        $occupied[$cp['team_no'] . '_' . $cp['slot_no']] = true;
    }
    
    $freeSlotsCount = 4 - count($occupied);
    $team1Free = !isset($occupied['1_1']) && !isset($occupied['1_2']);
    $team2Free = !isset($occupied['2_1']) && !isset($occupied['2_2']);

    if ($freeSlotsCount > 0) {
        notifyWaitlistAvailability($pdo, $match_id, 'solo', $uid);
    }
    if ($team1Free || $team2Free) {
        notifyWaitlistAvailability($pdo, $match_id, 'team', $uid);
    }

    $message = $isTeamJoin
        ? 'You and your partner have been removed from the match.'
        : 'You have been removed from the match.';

    if ($isLate) {
        $message .= ' Note: This is a late withdrawal (within 6 hours of the match).';
    }

    jsonResponse(true, $message, [
        'is_team'    => $isTeamJoin,
        'is_late'    => $isLate,
        'affected'   => $affectedUsers,
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(false, 'Withdrawal failed: ' . $e->getMessage(), null, 500);
}
