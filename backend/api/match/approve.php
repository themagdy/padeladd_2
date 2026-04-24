<?php
/**
 * POST /api/match/approve
 * Partner approves a team join request from the waiting list.
 * Slots are filled only if team 2 still has 2 open spots.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$wl_id = (int)($data['waiting_list_id'] ?? 0);
if ($wl_id <= 0) {
    jsonResponse(false, 'waiting_list_id is required.', null, 422);
}

try {
    $pdo->beginTransaction();

    // Fetch and lock the request
    $wlStmt = $pdo->prepare("
        SELECT * FROM waiting_list WHERE id = ? AND partner_id = ? AND request_status = 'pending' FOR UPDATE
    ");
    $wlStmt->execute([$wl_id, $uid]);
    $wl = $wlStmt->fetch(PDO::FETCH_ASSOC);
    if (!$wl) {
        $pdo->rollBack();
        jsonResponse(false, 'Request not found or you are not the partner.', null, 404);
    }

    $match_id    = (int)$wl['match_id'];
    $requester_id = (int)$wl['requester_id'];
    $partner_id   = $uid;

    // Lock match
    $mStmt = $pdo->prepare("SELECT * FROM matches WHERE id = ? AND status IN ('open', 'full', 'on_hold') FOR UPDATE");
    $mStmt->execute([$match_id]);
    $match = $mStmt->fetch(PDO::FETCH_ASSOC);
    if (!$match) {
        $pdo->rollBack();
        jsonResponse(false, 'Match is no longer available.', null, 409);
    }

    // --- SPECIAL CASE: Match Creation Team 1 Approval ---
    if ($match['status'] === 'on_hold' && (int)$match['creator_id'] === $requester_id && (int)$match['created_with_partner'] === 1) {
        
        // Find creator's side to assign the opposite to partner
        $creatorStmt = $pdo->prepare("SELECT playing_side FROM match_players WHERE match_id = ? AND user_id = ?");
        $creatorStmt->execute([$match_id, $requester_id]);
        $creatorRow = $creatorStmt->fetch(PDO::FETCH_ASSOC);
        $creator_side = $creatorRow ? $creatorRow['playing_side'] : 'flexible';

        $partner_side = null;
        if ($creator_side === 'right') $partner_side = 'left';
        if ($creator_side === 'left') $partner_side = 'right';
        if ($creator_side === 'flexible') $partner_side = 'flexible';

        // Insert partner into Team 1, Slot 2
        $ins = $pdo->prepare("
            INSERT INTO match_players (match_id, user_id, team_no, slot_no, join_type, status, playing_side)
            VALUES (?, ?, 1, 2, 'team', 'confirmed', ?)
        ");
        $ins->execute([$match_id, $partner_id, $partner_side]);
        $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, points) VALUES (?, 50)")->execute([$partner_id]);

        // Finish waiting list
        $pdo->prepare("UPDATE waiting_list SET request_status = 'joined' WHERE id = ?")->execute([$wl_id]);

        // Open the match
        $pdo->prepare("UPDATE matches SET status = 'open' WHERE id = ?")->execute([$match_id]);

        $pdo->commit();

        // Phase 6: Notify requester (match creator) that partner approved
        $approverName = getDisplayName($user);
        createNotification($pdo, $requester_id, 'partner_confirmed', $match_id, "✅ {$approverName} accepted your team invite", $uid);

        jsonResponse(true, 'You have approved the request and joined the match as the creator\'s partner.', null);
    }

    // Ensure neither player is already in the match
    $dupCheck = $pdo->prepare("SELECT id FROM match_players WHERE match_id = ? AND user_id = ?");
    $dupCheck->execute([$match_id, $requester_id]);
    if ($dupCheck->fetch()) {
        $pdo->rollBack();
        jsonResponse(false, 'Requester is already in this match.', null, 409);
    }
    $dupCheck->execute([$match_id, $partner_id]);
    if ($dupCheck->fetch()) {
        $pdo->rollBack();
        jsonResponse(false, 'You are already in this match.', null, 409);
    }

    // Verify team 2 still has 2 open slots
    $slotsStmt = $pdo->prepare("SELECT team_no, slot_no FROM match_players WHERE match_id = ? FOR UPDATE");
    $slotsStmt->execute([$match_id]);
    $occupied = $slotsStmt->fetchAll(PDO::FETCH_ASSOC);
    $occupiedMap = [];
    foreach ($occupied as $o) {
        $occupiedMap[$o['team_no'] . '_' . $o['slot_no']] = true;
    }
    $t2Open = [];
    foreach ([[2,1],[2,2]] as [$t,$s]) {
        if (!isset($occupiedMap[$t . '_' . $s])) $t2Open[] = [$t, $s];
    }
    if (count($t2Open) < 2) {
        // Match/Team 2 is full, so just mark as approved and STAY in the waiting list (as a queue)
        $pdo->prepare("UPDATE waiting_list SET request_status = 'approved' WHERE id = ?")->execute([$wl_id]);
        $pdo->commit();
        jsonResponse(true, 'Team 2 slots are full. Your team has been added to the waiting list queue.', [
            'waiting_list_id' => $wl_id,
            'in_waitlist' => true
        ]);
    }

    // Fetch playing sides from profiles
    $ups = $pdo->prepare("SELECT user_id, playing_side FROM user_profiles WHERE user_id IN (?, ?)");
    $ups->execute([$requester_id, $partner_id]);
    $profiles = $ups->fetchAll(PDO::FETCH_ASSOC);
    $sidesMap = [];
    foreach ($profiles as $p) {
        $sidesMap[(int)$p['user_id']] = $p['playing_side'];
    }
    
    $req_side = $sidesMap[$requester_id] ?? 'flexible';
    $par_side = $data['playing_side'] ?? ($sidesMap[$partner_id] ?? 'flexible');

    // Insert both players into team 2
    $ins = $pdo->prepare("
        INSERT INTO match_players (match_id, user_id, team_no, slot_no, join_type, status, playing_side)
        VALUES (?, ?, ?, ?, 'team', 'confirmed', ?)
    ");
    $ins->execute([$match_id, $requester_id, 2, 1, $req_side]);
    $ins->execute([$match_id, $partner_id,   2, 2, $par_side]);


    // Ensure player_stats rows (starting points = 50 per brief)
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, points) VALUES (?, 50)")->execute([$requester_id]);
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, points) VALUES (?, 50)")->execute([$partner_id]);

    // Move to joined status (terminal)
    $pdo->prepare("UPDATE waiting_list SET request_status = 'joined' WHERE id = ?")->execute([$wl_id]);

    // Cancel all other pending requests for this match (team 2 is now full)
    $pdo->prepare("
        UPDATE waiting_list SET request_status = 'cancelled'
        WHERE match_id = ? AND request_status = 'pending' AND id != ?
    ")->execute([$match_id, $wl_id]);

    // Check if match is now full
    if (count($occupied) + 2 >= 4) {
        $pdo->prepare("UPDATE matches SET status = 'full' WHERE id = ?")->execute([$match_id]);
    }

    $pdo->commit();

    // Phase 6: Notify requester that partner approved and they are in the match
    $approverName = getDisplayName($user);
    createNotification($pdo, $requester_id, 'partner_confirmed', $match_id, "{$approverName} accepted your team invite", $uid);

    // Phase 6: Notify match participants that a team joined (excluding requester who already got confirmed notif)
    notifyMatchParticipants($pdo, $match_id, 'match_joined', "{$approverName} and their partner joined the match", $uid, [$requester_id]);

    jsonResponse(true, 'You have approved the request. Both players are now in the match.', null);

} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(false, 'Approve failed: ' . $e->getMessage(), null, 500);
}
