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
    $mStmt = $pdo->prepare("SELECT * FROM matches WHERE id = ? FOR UPDATE");
    $mStmt->execute([$match_id]);
    $match = $mStmt->fetch(PDO::FETCH_ASSOC);

    if (!$match) {
        throw new Exception('Match not found.');
    }
    if ($match['status'] === 'cancelled') {
        throw new Exception('Match is cancelled.');
    }

    // Cannot jump-in if match start time has passed
    if (strtotime($match['match_datetime']) <= time()) {
        throw new Exception('Cannot join or jump-in to a match that has already passed.');
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

    // 2. Check current occupied slots (including user_id for friendly match team average checks)
    $playersStmt = $pdo->prepare("SELECT user_id, team_no, slot_no FROM match_players WHERE match_id = ? FOR UPDATE");
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

    // ── Eligibility Check: Points, Gender, and Friendly Average ─────────
    $joiningUserIds = $isSolo ? [$uid] : [(int)$wl['requester_id'], (int)$wl['partner_id']];

    // A. Points Range Check
    $eligMin = (int)$match['eligible_min'];
    $eligMax = (int)$match['eligible_max'];

    foreach ($joiningUserIds as $jUid) {
        $ptsStmt = $pdo->prepare("SELECT current_buffer, rank_points FROM player_stats WHERE user_id = ?");
        $ptsStmt->execute([$jUid]);
        $ptsRow = $ptsStmt->fetch(PDO::FETCH_ASSOC);
        $jPts = 100;
        if ($ptsRow) {
            $jPts = (int)($ptsRow['rank_points'] ?? 0) + (int)($ptsRow['current_buffer'] ?? 100);
        }
        if ($jPts < $eligMin || $jPts > $eligMax) {
            $nickStmt = $pdo->prepare("SELECT nickname FROM user_profiles WHERE user_id = ?");
            $nickStmt->execute([$jUid]);
            $nick = $nickStmt->fetchColumn() ?: "Player";
            throw new Exception("{$nick} is not eligible for this match. Points ({$jPts}) must be between {$eligMin} and {$eligMax}.");
        }
    }

    // B. Same Gender Check
    if ($match['gender_type'] === 'same_gender') {
        $stmtC = $pdo->prepare("SELECT gender FROM user_profiles WHERE user_id = ?");
        $stmtC->execute([$match['creator_id']]);
        $creatorGender = $stmtC->fetchColumn() ?: 'male';

        foreach ($joiningUserIds as $jUid) {
            $stmtJ = $pdo->prepare("SELECT gender, nickname FROM user_profiles WHERE user_id = ?");
            $stmtJ->execute([$jUid]);
            $jRow = $stmtJ->fetch(PDO::FETCH_ASSOC);
            $jGender = $jRow ? $jRow['gender'] : 'male';
            $nick = $jRow ? $jRow['nickname'] : 'Player';

            if ($jGender !== $creatorGender) {
                $genderLabel = $creatorGender === 'female' ? 'Females Only' : 'Males Only';
                throw new Exception("{$nick} is not eligible for this match. This is a {$genderLabel} match.");
            }
        }
    }

    // C. Friendly Match Team Points average difference check (<= 300)
    $newCount = count($players) + count($targetSlots);
    if ($match['match_type'] === 'friendly' && $newCount === 4) {
        $proj = [];
        foreach ($players as $p) {
            $proj[] = [
                'user_id' => (int)$p['user_id'],
                'team_no' => (int)$p['team_no']
            ];
        }
        foreach ($targetSlots as [$t, $s, $targetUid]) {
            $proj[] = [
                'user_id' => (int)$targetUid,
                'team_no' => (int)$t
            ];
        }

        $allIds = array_column($proj, 'user_id');
        $ph = implode(',', array_fill(0, count($allIds), '?'));
        $ptsSt = $pdo->prepare("SELECT user_id, current_buffer, rank_points FROM player_stats WHERE user_id IN ($ph)");
        $ptsSt->execute($allIds);
        $ptsMap = [];
        foreach ($ptsSt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $ptsMap[(int)$r['user_id']] = (int)($r['rank_points'] ?? 0) + (int)($r['current_buffer'] ?? 100);
        }
        foreach ($allIds as $pid) {
            if (!isset($ptsMap[$pid])) $ptsMap[$pid] = 100;
        }

        $t1pts = array_map(fn($p) => $ptsMap[(int)$p['user_id']], array_filter($proj, fn($p) => (int)$p['team_no'] === 1));
        $t2pts = array_map(fn($p) => $ptsMap[(int)$p['user_id']], array_filter($proj, fn($p) => (int)$p['team_no'] === 2));

        if (count($t1pts) === 2 && count($t2pts) === 2) {
            $avgA = array_sum($t1pts) / 2;
            $avgB = array_sum($t2pts) / 2;
            $teamDiff = abs($avgA - $avgB);
            if ($teamDiff > 300) {
                throw new Exception("Team skill gap is too large for a friendly match (diff: {$teamDiff}, max allowed: 300).");
            }
        }
    }

    // 3. Move to match_players
    foreach ($targetSlots as [$t, $s, $targetUid]) {
        // Get user side preference and stats
        $stmt = $pdo->prepare("
            SELECT up.playing_side, ps.rank_points, ps.current_buffer 
            FROM user_profiles up 
            LEFT JOIN player_stats ps ON up.user_id = ps.user_id 
            WHERE up.user_id = ?
        ");
        $stmt->execute([$targetUid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $side = $row ? $row['playing_side'] : 'flexible';
        $rp   = (int)($row['rank_points'] ?? 0);
        $bp   = (int)($row['current_buffer'] ?? 100);

        $ins = $pdo->prepare("
            INSERT INTO match_players (match_id, user_id, team_no, slot_no, join_type, status, playing_side, rank_points_at_join, buffer_points_at_join)
            VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
        ");
        $ins->execute([$match_id, $targetUid, $t, $s, ($isSolo ? 'solo' : 'team'), $side, $rp, $bp]);
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

    // Phase 9: Update automated story
    require_once __DIR__ . '/../../helpers/story_helper.php';
    StoryHelper::updateMatchStory($pdo, $match_id);

    jsonResponse(true, 'Jumped in successfully!');

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonResponse(false, $e->getMessage(), null, 400);
}
