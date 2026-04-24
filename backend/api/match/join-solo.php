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
    $slotsStmt = $pdo->prepare("SELECT team_no, slot_no FROM match_players WHERE match_id = ? FOR UPDATE");
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

    // ── Eligibility Check (per brief: points_integrity.md) ─────────────────
    // Only enforce when this join would complete both teams (4 players total).
    // Build projected team compositions with the joining player included.
    if (count($occupied) + 1 === 4) {
        // Get stats for all current players
        $currentIds = array_column($occupied, 'user_id');
        $allCheckIds = array_merge($currentIds, [$uid]);
        $phStr = implode(',', array_fill(0, count($allCheckIds), '?'));
        $statsStmt = $pdo->prepare("SELECT user_id, points, matches_played FROM player_stats WHERE user_id IN ($phStr)");
        $statsStmt->execute($allCheckIds);
        $statsMap = [];
        foreach ($statsStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $statsMap[(int)$r['user_id']] = ['points' => (int)$r['points'], 'matches_played' => (int)$r['matches_played']];
        }
        // Default to starting values if no stats yet
        foreach ($allCheckIds as $pid) {
            if (!isset($statsMap[$pid])) $statsMap[$pid] = ['points' => 50, 'matches_played' => 0];
        }

        // Build projected teams (include joining player in their target slot)
        $projectedPlayers = array_merge($occupied, [['user_id' => $uid, 'team_no' => $targetTeam, 'slot_no' => $targetSlot]]);
        $projT1 = array_values(array_filter($projectedPlayers, fn($p) => (int)$p['team_no'] === 1));
        $projT2 = array_values(array_filter($projectedPlayers, fn($p) => (int)$p['team_no'] === 2));

        if (count($projT1) === 2 && count($projT2) === 2) {
            $eligResult = checkTeamEligibility(
                array_map(fn($p) => $statsMap[(int)$p['user_id']], $projT1),
                array_map(fn($p) => $statsMap[(int)$p['user_id']], $projT2)
            );
            if (!$eligResult['eligible']) {
                $pdo->rollBack();
                jsonResponse(false, 'Teams are too mismatched for a fair game. Your skill gap is ' . $eligResult['gap'] . ' (tolerance: ' . $eligResult['tolerance'] . '). Consider joining the waitlist instead.', [
                    'eligibility_failed' => true,
                    'gap'        => $eligResult['gap'],
                    'tolerance'  => $eligResult['tolerance'],
                ], 422);
            }
        }
    }

    // Insert the player
    $ins = $pdo->prepare("
        INSERT INTO match_players (match_id, user_id, team_no, slot_no, join_type, status, playing_side)
        VALUES (?, ?, ?, ?, 'solo', 'confirmed', ?)
    ");
    $ins->execute([$match_id, $uid, $targetTeam, $targetSlot, $user_side]);


    // Cleanup: Cancel any existing waiting list entries for this user in this match
    $pdo->prepare("
        UPDATE waiting_list SET request_status = 'joined'
        WHERE match_id = ? AND (requester_id = ? OR partner_id = ?) AND request_status IN ('pending', 'approved')
    ")->execute([$match_id, $uid, $uid]);

    // Ensure player_stats row (starting points = 50 per brief)
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, points) VALUES (?, 50)")->execute([$uid]);

    // Check if match is now full
    if (count($occupied) + 1 >= 4) {
        $pdo->prepare("UPDATE matches SET status = 'full' WHERE id = ?")->execute([$match_id]);
    }

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
