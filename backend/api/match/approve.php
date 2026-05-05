<?php
/**
 * POST /api/match/approve
 * Partner approves a team join request from the waiting list.
 * Slots are filled only if team 2 still has 2 open spots.
 */
require_once __DIR__ . '/../../helpers/ranking_helper.php';
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

    // Fetch current stats for snapshotting
    $ptsStmt = $pdo->prepare("SELECT user_id, current_buffer, rank_points FROM player_stats WHERE user_id IN (?, ?)");
    $ptsStmt->execute([$requester_id, $partner_id]);
    $ptsRows = $ptsStmt->fetchAll(PDO::FETCH_ASSOC);
    $ptsMap = [];
    foreach ($ptsRows as $pr) { $ptsMap[(int)$pr['user_id']] = $pr; }

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

        $parRP = (int)($ptsMap[$partner_id]['rank_points'] ?? 0);
        $parBP = (int)($ptsMap[$partner_id]['current_buffer'] ?? 100);

        // Insert partner into Team 1, Slot 2
        $ins = $pdo->prepare("
            INSERT INTO match_players (match_id, user_id, team_no, slot_no, join_type, status, playing_side, rank_points_at_join, buffer_points_at_join)
            VALUES (?, ?, 1, 2, 'team', 'confirmed', ?, ?, ?)
        ");
        $ins->execute([$match_id, $partner_id, $partner_side, $parRP, $parBP]);
        $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, current_buffer, initial_buffer, buffer_matches_left, rank_points) VALUES (?, 100, 100, 20, 0)")->execute([$partner_id]);

        // Finish waiting list
        $pdo->prepare("UPDATE waiting_list SET request_status = 'joined' WHERE id = ?")->execute([$wl_id]);

        // Open the match
        $pdo->prepare("UPDATE matches SET status = 'open' WHERE id = ?")->execute([$match_id]);

        // Audit log: Partner joined (Special case creator partner)
        $pdo->prepare("INSERT INTO match_events (match_id, user_id, event_type, event_data) VALUES (?, ?, 'player_joined', ?)")
            ->execute([$match_id, $partner_id, json_encode(['role' => 'partner_creator'])]);

        $pdo->commit();

        // Phase 6: Notify requester (match creator) that partner approved
        $approverName = getDisplayName($user);
        createNotification($pdo, $requester_id, 'partner_confirmed', $match_id, "{$approverName} accepted your team invite", $uid);

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
    $slotsStmt = $pdo->prepare("SELECT user_id, team_no, slot_no FROM match_players WHERE match_id = ? FOR UPDATE");
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

    // ── Eligibility Check (per brief: points_integrity.md) ─────────────────
    // Team 1 already has 2 confirmed players; check if Team 2 (joining) is a fair match.
    $team1Players = array_values(array_filter($occupied, fn($o) => (int)$o['team_no'] === 1));
    if (count($team1Players) === 2) {
        $allCheckIds = array_map('intval', array_column($occupied, 'user_id'));
        $allCheckIds = array_merge($allCheckIds, [$requester_id, $partner_id]);
        $phStr = implode(',', array_fill(0, count($allCheckIds), '?'));
        $statsStmt = $pdo->prepare("SELECT user_id, current_buffer, rank_points, buffer_matches_left, matches_played FROM player_stats WHERE user_id IN ($phStr)");
        $statsStmt->execute($allCheckIds);
        $statsMap = [];
        foreach ($statsStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $pts = (int)$r['buffer_matches_left'] > 0 ? (int)($r['current_buffer'] ?? 100) : (int)($r['rank_points'] ?? 50);
            $statsMap[(int)$r['user_id']] = ['points' => $pts, 'matches_played' => (int)$r['matches_played']];
        }
        foreach ($allCheckIds as $pid) {
            if (!isset($statsMap[$pid])) $statsMap[$pid] = ['points' => 0, 'matches_played' => 0];
        }
        $t1Stats = array_map(fn($p) => $statsMap[(int)$p['user_id']], $team1Players);
        $t2Stats = [$statsMap[$requester_id], $statsMap[$partner_id]];
        $eligResult = checkTeamEligibility($t1Stats, $t2Stats);
        if (!$eligResult['eligible']) {
            $pdo->rollBack();
            jsonResponse(false, 'Teams are too mismatched for a fair game. Skill gap is ' . $eligResult['gap'] . ' (tolerance: ' . $eligResult['tolerance'] . ').', [
                'eligibility_failed' => true,
                'gap'       => $eligResult['gap'],
                'tolerance' => $eligResult['tolerance'],
            ], 422);
        }
    }

    // ── Gender check for Same Gender matches ─────────────────────────────────
    if ($match['gender_type'] === 'same_gender') {
        // Creator's gender
        $stmtC = $pdo->prepare("SELECT gender FROM user_profiles WHERE user_id = ?");
        $stmtC->execute([$match['creator_id']]);
        $creatorGender = $stmtC->fetchColumn() ?: 'male';

        // Approver's gender
        $stmtA = $pdo->prepare("SELECT gender FROM user_profiles WHERE user_id = ?");
        $stmtA->execute([$uid]);
        $approverGender = $stmtA->fetchColumn() ?: 'male';

        // Requester's gender
        $stmtR = $pdo->prepare("SELECT gender FROM user_profiles WHERE user_id = ?");
        $stmtR->execute([$requester_id]);
        $requesterGender = $stmtR->fetchColumn() ?: 'male';

        if ($approverGender !== $creatorGender || $requesterGender !== $creatorGender) {
            $pdo->rollBack();
            $genderLabel = $creatorGender === 'female' ? 'Females Only' : 'Males Only';
            jsonResponse(false, "You are not eligible for this match. This is a {$genderLabel} match.", [
                'eligibility_failed' => true,
                'reason' => 'gender_mismatch'
            ], 422);
        }
    }

    $reqRP = (int)($ptsMap[$requester_id]['rank_points'] ?? 0);
    $reqBP = (int)($ptsMap[$requester_id]['current_buffer'] ?? 100);
    $parRP = (int)($ptsMap[$partner_id]['rank_points'] ?? 0);
    $parBP = (int)($ptsMap[$partner_id]['current_buffer'] ?? 100);

    // Insert both players into team 2
    $ins = $pdo->prepare("
        INSERT INTO match_players (match_id, user_id, team_no, slot_no, join_type, status, playing_side, rank_points_at_join, buffer_points_at_join)
        VALUES (?, ?, ?, ?, 'team', 'confirmed', ?, ?, ?)
    ");
    $ins->execute([$match_id, $requester_id, 2, 1, $req_side, $reqRP, $reqBP]);
    $ins->execute([$match_id, $partner_id,   2, 2, $par_side, $parRP, $parBP]);


    // Ensure player_stats rows (starting points = 0 per brief)
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, current_buffer, initial_buffer, buffer_matches_left, rank_points) VALUES (?, 100, 100, 20, 0)")->execute([$requester_id]);
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, current_buffer, initial_buffer, buffer_matches_left, rank_points) VALUES (?, 100, 100, 20, 0)")->execute([$partner_id]);

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

    // Audit log: Both players joined
    $pdo->prepare("INSERT INTO match_events (match_id, user_id, event_type, event_data) VALUES (?, ?, 'player_joined', ?)")
        ->execute([$match_id, $requester_id, json_encode(['type' => 'team'])]);
    $pdo->prepare("INSERT INTO match_events (match_id, user_id, event_type, event_data) VALUES (?, ?, 'player_joined', ?)")
        ->execute([$match_id, $partner_id, json_encode(['type' => 'team'])]);

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
