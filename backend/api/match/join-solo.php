<?php
/**
 * POST /api/match/join-solo
 * Current user joins a specific empty team/slot in an open match.
 * team_no and slot_no must be specified, or the backend picks the first available.
 */
require_once __DIR__ . '/../../helpers/ranking_helper.php';
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$match_id = (int)($data['match_id'] ?? 0);
$team_no  = isset($data['team_no'])  ? (int)$data['team_no']  : null;
$slot_no  = isset($data['slot_no'])  ? (int)$data['slot_no']  : null;

if ($match_id <= 0) {
    jsonResponse(false, 'match_id is required.', null, 422);
}

try {
    $pdo->beginTransaction();

    // Lock the match row to prevent concurrent joins
    $mStmt = $pdo->prepare("SELECT * FROM matches WHERE id = ? AND status IN ('open', 'full') FOR UPDATE");
    $mStmt->execute([$match_id]);
    $match = $mStmt->fetch(PDO::FETCH_ASSOC);
    if (!$match) {
        $pdo->rollBack();
        jsonResponse(false, 'Match not found or not open.', null, 404);
    }
    if ($match['match_datetime'] < date('Y-m-d H:i:s')) {
        $pdo->rollBack();
        jsonResponse(false, 'Cannot join a match that has already passed.', null, 422);
    }

    // Check user not already in match
    $dupCheck = $pdo->prepare("SELECT id FROM match_players WHERE match_id = ? AND user_id = ?");
    $dupCheck->execute([$match_id, $uid]);
    if ($dupCheck->fetch()) {
        $pdo->rollBack();
        jsonResponse(false, 'You are already in this match.', null, 409);
    }

    // Check if user has any pending partner invitations for this match
    // If they do, they cannot join as solo (must commit to team path)
    $wlCheck = $pdo->prepare("
        SELECT id FROM waiting_list
        WHERE match_id = ? AND requester_id = ? AND request_status IN ('pending', 'approved')
        LIMIT 1
    ");
    $wlCheck->execute([$match_id, $uid]);
    if ($wlCheck->fetch()) {
        $pdo->rollBack();
        jsonResponse(false, 'You have a pending invitation or are already in the waiting list for this match.', null, 403);
    }

    // Check user is not globally blocked from joining matches
    $blockCheck = $pdo->prepare("
        SELECT id FROM blocked_partner_requests
        WHERE blocked_user_id = ? AND blocked_until > NOW()
        LIMIT 1
    ");
    $blockCheck->execute([$uid]);
    if ($blockCheck->fetch()) {
        $pdo->rollBack();
        jsonResponse(false, 'You are currently blocked from joining team matches due to repeated denied requests. Solo join is also unavailable during this period.', null, 403);
    }

    // Get current slots
    $slotsStmt = $pdo->prepare("SELECT user_id, team_no, slot_no FROM match_players WHERE match_id = ? FOR UPDATE");
    $slotsStmt->execute([$match_id]);
    $occupied = $slotsStmt->fetchAll(PDO::FETCH_ASSOC);

    // Build occupied map
    $occupiedMap = [];
    foreach ($occupied as $o) {
        $occupiedMap[$o['team_no'] . '_' . $o['slot_no']] = true;
    }

    $force_waitlist = (bool)($data['force_waitlist'] ?? false);

    if (count($occupied) >= 4 || $force_waitlist) {
        // Join Waiting List instead
        $ins = $pdo->prepare("
            INSERT INTO waiting_list (match_id, requester_id, partner_id, request_status)
            VALUES (?, ?, NULL, 'approved')
        ");
        $ins->execute([$match_id, $uid]);
        $pdo->commit();
        jsonResponse(true, $force_waitlist ? 'You have been added to the waiting list.' : 'Match is full. You have been added to the waiting list.', [
            'waiting_list_id' => (int)$pdo->lastInsertId(),
            'in_waitlist' => true
        ]);
    }


    // Determine target slot
    $targetTeam = null;
    $targetSlot = null;

    if ($team_no && $slot_no) {
        // Specific slot requested
        if (!in_array($team_no, [1, 2]) || !in_array($slot_no, [1, 2])) {
            $pdo->rollBack();
            jsonResponse(false, 'Invalid team_no or slot_no.', null, 422);
        }
        if (isset($occupiedMap[$team_no . '_' . $slot_no])) {
            $pdo->rollBack();
            jsonResponse(false, 'That slot is already taken.', null, 409);
        }
        $targetTeam = $team_no;
        $targetSlot = $slot_no;
    } else {
        // Auto-pick first available slot (prefer team 2)
        $preferOrder = [[2,1],[2,2],[1,2],[1,1]];
        foreach ($preferOrder as [$t, $s]) {
            if (!isset($occupiedMap[$t . '_' . $s])) {
                $targetTeam = $t;
                $targetSlot = $s;
                break;
            }
        }
        if (!$targetTeam) {
            $pdo->rollBack();
            jsonResponse(false, 'No open slots available.', null, 409);
        }
    }

    // Fetch user's side from profile (default)
    $ups = $pdo->prepare("SELECT playing_side FROM user_profiles WHERE user_id = ?");
    $ups->execute([$uid]);
    $upRow = $ups->fetch();
    $profile_side = $upRow ? $upRow['playing_side'] : 'flexible';

    // Use overrides if provided
    $user_side = $data['playing_side'] ?? $profile_side;

    // ── Eligibility Check ────────────────────────────────────────────────
    // Fetch match eligibility range (locked at creation)
    $eligMin = (int)$match['eligible_min'];
    $eligMax = (int)$match['eligible_max'];

    // Get joining player's points
    $ptsStmt = $pdo->prepare("SELECT current_buffer, rank_points, buffer_matches_left FROM player_stats WHERE user_id = ?");
    $ptsStmt->execute([$uid]);
    $ptsRow = $ptsStmt->fetch(PDO::FETCH_ASSOC);
    
    $joinerPts = 100;
    if ($ptsRow) {
        $joinerPts = (int)($ptsRow['rank_points'] ?? 0) + (int)($ptsRow['current_buffer'] ?? 100);
    }

    if ($joinerPts < $eligMin || $joinerPts > $eligMax) {
        $pdo->rollBack();
        jsonResponse(false, "You are not eligible for this match. Your points ({$joinerPts}) must be between {$eligMin} and {$eligMax}.", [
            'eligibility_failed' => true,
            'your_points'   => $joinerPts,
            'eligible_min'  => $eligMin,
            'eligible_max'  => $eligMax,
        ], 422);
    }

    // ── Gender check for Same Gender matches ─────────────────────────────────
    if ($match['gender_type'] === 'same_gender') {
        // Creator's gender
        $stmtC = $pdo->prepare("SELECT gender FROM user_profiles WHERE user_id = ?");
        $stmtC->execute([$match['creator_id']]);
        $creatorGender = $stmtC->fetchColumn() ?: 'male';

        // Joiner's gender
        $stmtJ = $pdo->prepare("SELECT gender FROM user_profiles WHERE user_id = ?");
        $stmtJ->execute([$uid]);
        $joinerGender = $stmtJ->fetchColumn() ?: 'male';

        if ($joinerGender !== $creatorGender) {
            $pdo->rollBack();
            $genderLabel = $creatorGender === 'female' ? 'Females Only' : 'Males Only';
            jsonResponse(false, "You are not eligible for this match. This is a {$genderLabel} match.", [
                'eligibility_failed' => true,
                'reason' => 'gender_mismatch'
            ], 422);
        }
    }

    // Friendly match only: when this join makes the match full, check team avg diff <= 300
    if ($match['match_type'] === 'friendly' && count($occupied) + 1 === 4) {
        $allIds = array_merge(array_column($occupied, 'user_id'), [$uid]);
        $ph = implode(',', array_fill(0, count($allIds), '?'));
        $ptsSt = $pdo->prepare("SELECT user_id, current_buffer, rank_points, buffer_matches_left FROM player_stats WHERE user_id IN ($ph)");
        $ptsSt->execute($allIds);
        $ptsMap = [];
        foreach ($ptsSt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $ptsMap[(int)$r['user_id']] = (int)($r['rank_points'] ?? 0) + (int)($r['current_buffer'] ?? 100);
        }
        foreach ($allIds as $pid) { if (!isset($ptsMap[$pid])) $ptsMap[$pid] = 100; }

        $proj = array_merge($occupied, [['user_id' => $uid, 'team_no' => $targetTeam]]);
        $t1pts = array_map(fn($p) => $ptsMap[(int)$p['user_id']], array_filter($proj, fn($p) => (int)$p['team_no'] === 1));
        $t2pts = array_map(fn($p) => $ptsMap[(int)$p['user_id']], array_filter($proj, fn($p) => (int)$p['team_no'] === 2));

        if (count($t1pts) === 2 && count($t2pts) === 2) {
            $avgA = array_sum($t1pts) / 2;
            $avgB = array_sum($t2pts) / 2;
            $teamDiff = abs($avgA - $avgB);
            if ($teamDiff > 300) {
                $pdo->rollBack();
                jsonResponse(false, "Team skill gap is too large for a friendly match (diff: {$teamDiff}, max allowed: 300). Try a different slot.", [
                    'eligibility_failed' => true,
                    'team_diff' => round($teamDiff),
                ], 422);
            }
        }
    }

    // Insert the player
    $ins = $pdo->prepare("
        INSERT INTO match_players (match_id, user_id, team_no, slot_no, join_type, status, playing_side, rank_points_at_join, buffer_points_at_join)
        VALUES (?, ?, ?, ?, 'solo', 'confirmed', ?, ?, ?)
    ");
    $ins->execute([$match_id, $uid, $targetTeam, $targetSlot, $user_side, (int)($ptsRow['rank_points'] ?? 0), (int)($ptsRow['current_buffer'] ?? 100)]);


    // Cleanup: Cancel any existing waiting list entries for this user in this match
    $pdo->prepare("
        UPDATE waiting_list SET request_status = 'joined'
        WHERE match_id = ? AND (requester_id = ? OR partner_id = ?) AND request_status IN ('pending', 'approved')
    ")->execute([$match_id, $uid, $uid]);

    // Ensure player_stats row (starting points = 100 for beginners)
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, current_buffer, initial_buffer, buffer_matches_left, rank_points) VALUES (?, 100, 100, 20, 0)")->execute([$uid]);

    // Check if match is now full
    if (count($occupied) + 1 >= 4) {
        $pdo->prepare("UPDATE matches SET status = 'full' WHERE id = ?")->execute([$match_id]);
    }

    // Audit log: Player joined
    $pdo->prepare("INSERT INTO match_events (match_id, user_id, event_type, event_data) VALUES (?, ?, 'player_joined', ?)")
        ->execute([$match_id, $uid, json_encode(['type' => 'solo'])]);

    $pdo->commit();

    // Phase 6: Notify all match participants that a player joined
    $joinerName = getDisplayName($user);
    notifyMatchParticipants($pdo, $match_id, 'match_joined', "{$joinerName} joined the match", $uid);

    jsonResponse(true, 'You have joined the match.', [
        'team_no' => $targetTeam,
        'slot_no' => $targetSlot,
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(false, 'Join failed: ' . $e->getMessage(), null, 500);
}
