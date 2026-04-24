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
    $stmt = $pdo->prepare("
        SELECT m.*, u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        WHERE m.status IN ('open', 'full')
          AND m.match_datetime > DATE_SUB(NOW(), INTERVAL 6 HOUR)
        ORDER BY m.match_datetime ASC
        LIMIT 50
    ");
    $stmt->execute();
} elseif ($mode === 'play_past') {
    $stmt = $pdo->prepare("
        SELECT m.*, u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname
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
        SELECT m.*, u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        WHERE m.id IN (
            SELECT match_id FROM match_players WHERE user_id = ?
            UNION
            SELECT match_id FROM waiting_list WHERE (requester_id = ? OR partner_id = ?) AND request_status IN ('pending', 'approved')
        )
        AND m.status IN ('open', 'full', 'on_hold')
        AND m.match_datetime > DATE_SUB(NOW(), INTERVAL 6 HOUR)
        ORDER BY m.match_datetime ASC
        LIMIT 50
    ");
    $stmt->execute([$uid, $uid, $uid]);
} elseif ($mode === 'mine_completed') {
    $stmt = $pdo->prepare("
        SELECT m.*, u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        WHERE m.id IN (
            SELECT match_id FROM match_players WHERE user_id = ?
            UNION
            SELECT match_id FROM waiting_list WHERE (requester_id = ? OR partner_id = ?) AND request_status IN ('pending', 'approved')
        )
        AND m.status = 'completed'
        AND m.id IN (SELECT match_id FROM scores)
        ORDER BY m.match_datetime DESC
        LIMIT 50
    ");
    $stmt->execute([$uid, $uid, $uid]);
} elseif ($mode === 'mine_past') {
    $stmt = $pdo->prepare("
        SELECT m.*, u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        WHERE (m.creator_id = ? 
               OR m.id IN (SELECT match_id FROM match_players WHERE user_id = ?)
               OR m.id IN (SELECT match_id FROM waiting_list WHERE (requester_id = ? OR partner_id = ?))
        )
        AND m.status != 'completed'
        AND m.status != 'cancelled'
        AND m.match_datetime <= DATE_SUB(NOW(), INTERVAL 6 HOUR)
        AND m.id NOT IN (SELECT match_id FROM scores)
        ORDER BY m.match_datetime DESC
        LIMIT 50
    ");
    $stmt->execute([$uid, $uid, $uid, $uid]);
} else {
    // Fallback empty but with correct structure
    $stmt = $pdo->prepare("
        SELECT m.*, u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname
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
           u.first_name, u.last_name, up.player_code, up.profile_image, up.nickname
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

    $result[] = [
        'id'                   => $mid,
        'match_code'           => $m['match_code'],
        'venue_name'           => $m['venue_name'],
        'court_name'           => $m['court_name'],
        'match_datetime'       => $m['match_datetime'],
        'status'               => $m['status'],
        'created_with_partner' => (bool)$m['created_with_partner'],
        'creator_name'         => trim($m['creator_first'] . ' ' . $m['creator_last']),
        'creator_nickname'     => $m['creator_nickname'] ?? null,
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

jsonResponse(true, 'Matches loaded.', ['matches' => $result, 'mode' => $mode]);
