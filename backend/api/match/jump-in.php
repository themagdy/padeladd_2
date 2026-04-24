<?php
/**
 * POST /api/match/jump-in
 * Moves a user from the approved waiting list (queue) to an available slot in the match.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

$match_id = (int)($data['match_id'] ?? 0);
$waitlist_id = (int)($data['waitlist_id'] ?? 0);

if ($match_id <= 0 || $waitlist_id <= 0) {
    jsonResponse(false, 'match_id and waitlist_id are required.', null, 422);
}

try {
    $pdo->beginTransaction();

    // 1. Lock the match and waitlist entry
    $mStmt = $pdo->prepare("SELECT id, status, match_datetime FROM matches WHERE id = ? FOR UPDATE");
    $mStmt->execute([$match_id]);
    $match = $mStmt->fetch(PDO::FETCH_ASSOC);

    if (!$match) {
        throw new Exception('Match not found.');
    }
    if ($match['status'] === 'cancelled') {
        throw new Exception('Match is cancelled.');
    }

    $wlStmt = $pdo->prepare("SELECT * FROM waiting_list WHERE id = ? AND match_id = ? FOR UPDATE");
    $wlStmt->execute([$waitlist_id, $match_id]);
    $wl = $wlStmt->fetch(PDO::FETCH_ASSOC);

    if (!$wl) {
        throw new Exception('Waitlist entry not found.');
    }
    if ($wl['request_status'] !== 'approved') {
        throw new Exception('You are not in the queue or already joined.');
    }

    // Security: Ensure the caller is either the requester or the partner
    if ((int)$wl['requester_id'] !== $uid && (int)$wl['partner_id'] !== $uid) {
        throw new Exception('Unauthorized access to this waitlist entry.');
    }

    // 2. Check current occupied slots
    $playersStmt = $pdo->prepare("SELECT team_no, slot_no FROM match_players WHERE match_id = ? FOR UPDATE");
    $playersStmt->execute([$match_id]);
    $players = $playersStmt->fetchAll(PDO::FETCH_ASSOC);

    $occupied = [];
    foreach ($players as $p) {
        $occupied[$p['team_no'] . '_' . $p['slot_no']] = true;
    }

    $isSolo = empty($wl['partner_id']);
    $targetSlots = []; // Array of [team, slot, user_id]

    if ($isSolo) {
        // Solo Logic: find first free slot
        $found = false;
        $preferOrder = [[2,1],[2,2],[1,2],[1,1]];
        foreach ($preferOrder as [$t, $s]) {
            if (!isset($occupied[$t . '_' . $s])) {
                $targetSlots[] = [$t, $s, $uid];
                $found = true;
                break;
            }
        }
        if (!$found) {
            throw new Exception('No open slots available for solo join.');
        }
    } else {
        // Team Logic: find a team with both slots free
        $t1Free = !isset($occupied['1_1']) && !isset($occupied['1_2']);
        $t2Free = !isset($occupied['2_1']) && !isset($occupied['2_2']);

        if ($t2Free) {
            $targetSlots[] = [2, 1, $wl['requester_id']];
            $targetSlots[] = [2, 2, $wl['partner_id']];
        } elseif ($t1Free) {
            $targetSlots[] = [1, 1, $wl['requester_id']];
            $targetSlots[] = [1, 2, $wl['partner_id']];
        } else {
            throw new Exception('No full team slots available.');
        }
    }

    // 3. Move to match_players
    foreach ($targetSlots as [$t, $s, $targetUid]) {
        // Get user side preference
        $sideStmt = $pdo->prepare("SELECT playing_side FROM user_profiles WHERE user_id = ?");
        $sideStmt->execute([$targetUid]);
        $sideRow = $sideStmt->fetch();
        $side = $sideRow ? $sideRow['playing_side'] : 'flexible';

        $ins = $pdo->prepare("
            INSERT INTO match_players (match_id, user_id, team_no, slot_no, join_type, status, playing_side)
            VALUES (?, ?, ?, ?, ?, 'confirmed', ?)
        ");
        $ins->execute([$match_id, $targetUid, $t, $s, ($isSolo ? 'solo' : 'team'), $side]);
    }

    // 4. Mark waitlist as joined
    $pdo->prepare("UPDATE waiting_list SET request_status = 'joined' WHERE id = ?")->execute([$waitlist_id]);

    // 5. Update match status if full
    $newCount = count($players) + count($targetSlots);
    if ($newCount >= 4) {
        $pdo->prepare("UPDATE matches SET status = 'full' WHERE id = ?")->execute([$match_id]);
    }

    $pdo->commit();

    // Phase 6: Notify all match participants that a player/team joined
    $joinerName = getDisplayName($user);
    $msg = $isSolo ? "{$joinerName} jumped into the match" : "{$joinerName} and their partner jumped into the match";
    notifyMatchParticipants($pdo, $match_id, 'match_joined', $msg, $uid);

    jsonResponse(true, 'Jumped in successfully!');

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonResponse(false, $e->getMessage(), null, 400);
}
