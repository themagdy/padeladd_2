<?php
/**
 * POST /api/match/list
 * Returns all open matches the current user can join (not already in)
 * plus all matches the user is a participant of.
 *
 * mode: 'browse'  → shows open matches user is NOT in
 *       'mine'    → shows matches user IS in
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$mode = $data['mode'] ?? 'mine'; // 'mine' or 'browse'

// Fetch requesting player's points for eligibility labelling
$myPtsStmt = $pdo->prepare("SELECT COALESCE(points, 100) AS points FROM player_stats WHERE user_id = ?");
$myPtsStmt->execute([$uid]);
$myPoints = (int)($myPtsStmt->fetchColumn() ?: 100);

// Helper: get slot occupancy counts for a match
function getMatchSlots(PDO $pdo, int $match_id): array {
    $s = $pdo->prepare("
        SELECT mp.team_no, mp.slot_no, mp.join_type, mp.status, mp.playing_side,
               u.first_name, u.last_name, up.player_code, up.profile_image, up.nickname
        FROM match_players mp
        JOIN users u ON mp.user_id = u.id
        LEFT JOIN user_profiles up ON mp.user_id = up.user_id
        WHERE mp.match_id = ?
        ORDER BY mp.team_no, mp.slot_no
    ");
    $s->execute([$match_id]);
    return $s->fetchAll(PDO::FETCH_ASSOC);
}

if ($mode === 'play_upcoming') {
    $filterType = $data['match_type'] ?? 'all';
    $filterGender = $data['gender_type'] ?? 'all';

    $sql = "
        SELECT m.*, u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname, up.gender AS creator_gender
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        WHERE m.status IN ('open', 'full')
          AND m.match_datetime > DATE_SUB(NOW(), INTERVAL 2 HOUR)
    ";

    $params = [];
    if ($filterType !== 'all') {
        $sql .= " AND m.match_type = :match_type";
        $params[':match_type'] = $filterType;
    }
    if ($filterGender === 'same_gender') {
        // Only show matches created by someone of the same gender as me
        $sql .= " AND m.gender_type = 'same_gender' AND up.gender = (SELECT gender FROM user_profiles WHERE user_id = :uid_gender)";
        $params[':uid_gender'] = $uid;
    } elseif ($filterGender !== 'all') {
        $sql .= " AND m.gender_type = :gender_type";
        $params[':gender_type'] = $filterGender;
    }

    $sql .= " ORDER BY m.match_datetime ASC LIMIT 50";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
} elseif ($mode === 'play_past') {
    $stmt = $pdo->prepare("
        SELECT m.*, u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname, up.gender AS creator_gender
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        WHERE m.status = 'completed'
          AND m.id IN (SELECT match_id FROM scores)
        ORDER BY m.match_datetime DESC
        LIMIT 50
    ");
    $stmt->execute();
} elseif ($mode === 'mine_upcoming') {
    $stmt = $pdo->prepare("
        SELECT m.*, u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname, up.gender AS creator_gender
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        WHERE m.id IN (
            SELECT match_id FROM match_players WHERE user_id = ?
            UNION
            SELECT match_id FROM waiting_list WHERE (requester_id = ? OR partner_id = ?) AND request_status IN ('pending', 'approved')
        )
        AND m.status IN ('open', 'full', 'on_hold')
        AND m.match_datetime > DATE_SUB(NOW(), INTERVAL 2 HOUR)
        ORDER BY m.match_datetime ASC
        LIMIT 50
    ");
    $stmt->execute([$uid, $uid, $uid]);
} elseif ($mode === 'mine_completed') {
    $stmt = $pdo->prepare("
        SELECT m.*, u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname, up.gender AS creator_gender
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        WHERE m.id IN (
            SELECT match_id FROM match_players WHERE user_id = ?
        )
        AND m.status = 'completed'
        AND m.id IN (SELECT match_id FROM scores)
        ORDER BY m.match_datetime DESC
        LIMIT 50
    ");
    $stmt->execute([$uid]);
} elseif ($mode === 'mine_past') {
    $stmt = $pdo->prepare("
        SELECT m.*, u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname, up.gender AS creator_gender
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        WHERE (m.creator_id = ? 
               OR m.id IN (SELECT match_id FROM match_players WHERE user_id = ?)
        )
        AND (
            (m.status = 'cancelled') 
            OR 
            (m.status != 'completed' AND m.match_datetime <= DATE_SUB(NOW(), INTERVAL 2 HOUR))
        )
        ORDER BY m.match_datetime DESC
        LIMIT 50
    ");
    $stmt->execute([$uid, $uid]);
} else {
    // Fallback empty but with correct structure
    $stmt = $pdo->prepare("
        SELECT m.*, u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname, up.gender AS creator_gender
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        WHERE 1=0
    ");
    $stmt->execute();
}

$matches = $stmt->fetchAll(PDO::FETCH_ASSOC);
$result  = [];

if (empty($matches)) {
    jsonResponse(true, 'No matches found.', ['matches' => [], 'mode' => $mode]);
}

$matchIds = array_map(fn($m) => (int)$m['id'], $matches);
$matchIdsStr = implode(',', $matchIds);

// 1. Bulk fetch ALL slots for ALL matches in the list
$slotsStmt = $pdo->prepare("
    SELECT mp.match_id, mp.team_no, mp.slot_no, mp.join_type, mp.status, mp.playing_side, mp.user_id,
           u.first_name, u.last_name, up.player_code, up.profile_image, up.profile_image_thumb, up.nickname
    FROM match_players mp
    JOIN users u ON mp.user_id = u.id
    LEFT JOIN user_profiles up ON mp.user_id = up.user_id
    WHERE mp.match_id IN ($matchIdsStr)
    ORDER BY mp.match_id, mp.team_no, mp.slot_no
");
$slotsStmt->execute();
$allSlots = $slotsStmt->fetchAll(PDO::FETCH_ASSOC);

// Group slots by match_id
$slotsByMatch = [];
foreach ($allSlots as $s) {
    $slotsByMatch[$s['match_id']][] = $s;
}

// 2. Bulk fetch ALL waiting_list entries for current user in these matches
$wlStmt = $pdo->prepare("
    SELECT id, match_id, requester_id, partner_id, request_status 
    FROM waiting_list
    WHERE match_id IN ($matchIdsStr) 
      AND (requester_id = :uid1 OR partner_id = :uid2) 
      AND request_status IN ('pending', 'approved')
");
$wlStmt->bindValue(':uid1', $uid, PDO::PARAM_INT);
$wlStmt->bindValue(':uid2', $uid, PDO::PARAM_INT);
$wlStmt->execute();
$allWl = $wlStmt->fetchAll(PDO::FETCH_ASSOC);

$wlByMatch = [];
foreach ($allWl as $w) {
    $wlByMatch[$w['match_id']] = $w;
}

// 3. Construct result
foreach ($matches as $m) {
    $mid = (int)$m['id'];
    $slotsArray = $slotsByMatch[$mid] ?? [];
    
    // Count confirmed players
    $confirmedCount = 0;
    $userInMatch    = false;
    $userTeam       = null;
    $userSlot       = null;

    foreach ($slotsArray as $s) {
        if ($s['status'] === 'confirmed') $confirmedCount++;
        if ((int)$s['user_id'] === $uid) {
            $userInMatch = true;
            $userTeam    = (int)$s['team_no'];
            $userSlot    = (int)$s['slot_no'];
        }
    }

    $wlRequest = $wlByMatch[$mid] ?? null;
    $userIsInvited   = ($wlRequest && (int)$wlRequest['partner_id'] === $uid && $wlRequest['request_status'] === 'pending');
    $userIsRequester = ($wlRequest && (int)$wlRequest['requester_id'] === $uid && $wlRequest['request_status'] === 'pending');
    $userIsWaiting   = ($wlRequest && $wlRequest['request_status'] === 'approved');

    $eligible_min = (int)($m['eligible_min'] ?? 0);
    $eligible_max = (int)($m['eligible_max'] ?? 9999);
    $playerEligible = ($myPoints >= $eligible_min && $myPoints <= $eligible_max);
    $matchLabel = $playerEligible
        ? ($m['match_type'] === 'competition' ? 'Eligible' : 'Friendly')
        : 'Not Eligible';

    // Sort key: 1 = eligible competition, 2 = eligible friendly, 3 = not eligible
    $sortKey = !$playerEligible ? 3 : ($m['match_type'] === 'competition' ? 1 : 2);

    $result[] = [
        'id'                   => $mid,
        'match_code'           => $m['match_code'],
        'venue_name'           => $m['venue_name'],
        'court_name'           => $m['court_name'],
        'match_datetime'       => $m['match_datetime'],
        'status'               => $m['status'],
        'created_with_partner' => (bool)$m['created_with_partner'],
        'gender_type'          => $m['gender_type'],
        'match_type'           => $m['match_type'],
        'eligible_min'         => $eligible_min,
        'eligible_max'         => $eligible_max,
        'player_eligible'      => $playerEligible,
        'match_label'          => $matchLabel,
        'sort_key'             => $sortKey,
        'creator_name'         => trim($m['creator_first'] . ' ' . $m['creator_last']),
        'creator_nickname'     => $m['creator_nickname'] ?? null,
        'creator_gender'       => $m['creator_gender'] ?? 'male',
        'slots_confirmed'      => $confirmedCount,
        'slots_total'          => 4,
        'slots'                => $slotsArray,
        'user_in_match'        => $userInMatch,
        'user_team'            => $userTeam,
        'user_slot'            => $userSlot,
        'user_is_requester'    => $userIsRequester,
        'user_is_invited'      => $userIsInvited,
        'user_is_waiting'      => $userIsWaiting,
        'waiting_list_id'      => $wlRequest ? (int)$wlRequest['id'] : null,
    ];
}

// Sort browse results: eligible competition → friendly → not eligible
if ($mode === 'play_upcoming') {
    usort($result, fn($a, $b) => $a['sort_key'] <=> $b['sort_key'] ?: strtotime($a['match_datetime']) <=> strtotime($b['match_datetime']));
}

jsonResponse(true, 'Matches loaded.', ['matches' => $result, 'mode' => $mode]);
