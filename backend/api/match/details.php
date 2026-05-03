<?php
/**
 * POST /api/match/details
 * Returns full details for a single match including all slot info and waiting list.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$match_id   = (int)($data['match_id'] ?? 0);
$match_code = trim($data['match_code'] ?? '');

if ($match_id <= 0 && $match_code === '') {
    jsonResponse(false, 'match_id or match_code is required.', null, 422);
}

// Fetch requesting player's points and gender for eligibility
$myInfoStmt = $pdo->prepare("
    SELECT ps.current_buffer, ps.rank_points, ps.buffer_matches_left, up.gender 
    FROM users u 
    LEFT JOIN player_stats ps ON u.id = ps.user_id 
    LEFT JOIN user_profiles up ON u.id = up.user_id 
    WHERE u.id = ?
");
$myInfoStmt->execute([$uid]);
$myInfo = $myInfoStmt->fetch(PDO::FETCH_ASSOC);

$myPoints = 100;
if ($myInfo) {
    $myPoints = (int)($myInfo['rank_points'] ?? 0) + (int)($myInfo['current_buffer'] ?? 100);
}
$myGender = $myInfo['gender'] ?? 'male';

// Fetch match
if ($match_id > 0) {
    $stmt = $pdo->prepare("
        SELECT m.*, v.name AS official_venue_name, v.venue_location_link,
               u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname, up.gender AS creator_gender, up.player_code AS creator_code
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        LEFT JOIN venues v ON m.venue_id = v.id
        WHERE m.id = ?
    ");
    $stmt->execute([$match_id]);
} else {
    $stmt = $pdo->prepare("
        SELECT m.*, v.name AS official_venue_name, v.venue_location_link,
               u.first_name AS creator_first, u.last_name AS creator_last, up.nickname AS creator_nickname, up.gender AS creator_gender, up.player_code AS creator_code
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        LEFT JOIN venues v ON m.venue_id = v.id
        WHERE m.match_code = ?
    ");
    $stmt->execute([$match_code]);
}
$m = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$m) {
    jsonResponse(false, 'Match not found.', null, 404);
}

// Slot details — show rank_points (competition merit) not eligibility points
$slotStmt = $pdo->prepare("
    SELECT mp.team_no, mp.slot_no, mp.join_type, mp.status, mp.user_id, mp.playing_side,
           u.first_name, u.last_name,
           up.player_code, up.profile_image, up.profile_image_thumb, up.nickname, up.gender,
           COALESCE(ps.rank_points, 0) AS points, ps.matches_played
    FROM match_players mp
    JOIN users u ON mp.user_id = u.id
    LEFT JOIN user_profiles up ON mp.user_id = up.user_id
    LEFT JOIN player_stats ps ON mp.user_id = ps.user_id
    WHERE mp.match_id = ?
    ORDER BY mp.team_no, mp.slot_no
");
$slotStmt->execute([$m['id']]);
$slots = $slotStmt->fetchAll(PDO::FETCH_ASSOC);

// Waiting list
$wlStmt = $pdo->prepare("
    SELECT wl.id, wl.request_status, wl.created_at,
           ur.first_name AS req_first, ur.last_name AS req_last, upr.player_code AS req_code, upr.nickname AS req_nickname, upr.playing_side AS req_side, upr.profile_image AS req_profile, upr.profile_image_thumb AS req_profile_thumb, upr.gender AS req_gender,
           up2.first_name AS par_first, up2.last_name AS par_last, upp.player_code AS par_code, upp.nickname AS par_nickname, upp.playing_side AS par_side, upp.profile_image AS par_profile, upp.profile_image_thumb AS par_profile_thumb, upp.gender AS par_gender,
           wl.requester_id, wl.partner_id
    FROM waiting_list wl
    JOIN users ur  ON wl.requester_id = ur.id
    LEFT JOIN users up2 ON wl.partner_id = up2.id
    LEFT JOIN user_profiles upr ON wl.requester_id = upr.user_id
    LEFT JOIN user_profiles upp ON wl.partner_id   = upp.user_id
    WHERE wl.match_id = ?
    ORDER BY wl.created_at ASC
");
$wlStmt->execute([$m['id']]);
$waiting_list = $wlStmt->fetchAll(PDO::FETCH_ASSOC);

// Is the current user already in the match?
$mySlotData = null;
foreach ($slots as $s) {
    if ((int)$s['user_id'] === $uid) {
        $mySlotData = $s;
        break;
    }
}

// Request/Waitlist involving current user
$pendingForMe     = null;
$myPendingRequest = null; // Outgoing invitation
$myWaitlistEntry  = null; // In queue (approved)
foreach ($waiting_list as $w) {
    if ((int)$w['partner_id'] === $uid && $w['request_status'] === 'pending') {
        $pendingForMe = $w;
    }
    if ((int)$w['requester_id'] === $uid && $w['request_status'] === 'pending') {
        $myPendingRequest = $w;
    }
    // If approved but still in waiting_list, it means they are in queue
    if ($w['request_status'] === 'approved') {
        if ((int)$w['requester_id'] === $uid || (int)$w['partner_id'] === $uid) {
            $myWaitlistEntry = $w;
        }
    }
}

// Fetch late withdrawal events if any
$lw = $pdo->prepare("
    SELECT me.*, u.first_name, u.last_name, up.nickname, up.player_code
    FROM match_events me
    JOIN users u ON me.user_id = u.id
    LEFT JOIN user_profiles up ON me.user_id = up.user_id
    WHERE me.match_id = ? AND me.event_type = 'late_withdrawal'
    ORDER BY me.created_at DESC LIMIT 1
");

$lw->execute([$m['id']]);
$lateWithdrawal = $lw->fetch(PDO::FETCH_ASSOC);

if ($lateWithdrawal) {
    $lateWithdrawal['event_data'] = json_decode($lateWithdrawal['event_data'], true);
}

// Fetch current user's preferred side from profile
$ups = $pdo->prepare("SELECT playing_side FROM user_profiles WHERE user_id = ?");
$ups->execute([$uid]);
$upRow = $ups->fetch();
$user_playing_side = $upRow ? $upRow['playing_side'] : 'flexible';

// Ensure read status table exists
$pdo->exec('CREATE TABLE IF NOT EXISTS chat_read_status (
    user_id INT,
    match_id INT,
    last_read_id INT DEFAULT 0,
    PRIMARY KEY (user_id, match_id)
)');

// Fetch last read message ID for this user/match
$readStmt = $pdo->prepare("SELECT last_read_id FROM chat_read_status WHERE user_id = ? AND match_id = ?");
$readStmt->execute([$uid, (int)$m['id']]);
$lastReadId = (int)$readStmt->fetchColumn();

// Count unread messages (excluding those sent by the current user)
$unreadStmt = $pdo->prepare("SELECT COUNT(*) FROM chat_messages WHERE match_id = ? AND user_id != ? AND id > ?");
$unreadStmt->execute([(int)$m['id'], $uid, $lastReadId]);
$unreadCount = (int)$unreadStmt->fetchColumn();

// Fetch scores and disputes
$scoresStmt = $pdo->prepare("
    SELECT s.*, u.first_name, u.last_name, up.nickname
    FROM scores s
    JOIN users u ON s.submitted_by_user_id = u.id
    LEFT JOIN user_profiles up ON s.submitted_by_user_id = up.user_id
    WHERE s.match_id = ?
    ORDER BY s.created_at ASC
");
$scoresStmt->execute([$m['id']]);
$rawScores = $scoresStmt->fetchAll(PDO::FETCH_ASSOC);

// Is the current user a player in this match?
$isPlayer = ($mySlotData !== null);

$scores = [];
foreach ($rawScores as $sc) {
    if ($sc['status'] === 'approved' || $isPlayer) {
        $scores[] = $sc;
    }
}

$disputes = [];
if ($isPlayer) {
    $disputesStmt = $pdo->prepare("SELECT * FROM disputes WHERE match_id = ?");
    $disputesStmt->execute([$m['id']]);
    $disputes = $disputesStmt->fetchAll(PDO::FETCH_ASSOC);
}

jsonResponse(true, 'Match details loaded.', [
    'match' => [
        'id'                   => (int)$m['id'],
        'match_code'           => $m['match_code'],
        'venue_name'           => $m['official_venue_name'] ?: 'Venue TBD',
        'venue_location_link'  => $m['venue_location_link'] ?? null,
        'court_name'           => $m['court_name'],
        'match_datetime'       => $m['match_datetime'],
        'status'               => $m['status'],
        'created_with_partner' => (bool)$m['created_with_partner'],
        'gender_type'          => $m['gender_type'],
        'match_type'           => $m['match_type'],
        'creator_id'           => (int)$m['creator_id'],
        'creator_name'         => trim($m['creator_first'] . ' ' . $m['creator_last']),
        'creator_nickname'     => $m['creator_nickname'] ?? null,
        'creator_code'         => $m['creator_code'] ?? null,
        'creator_gender'       => $m['creator_gender'] ?? 'male',
        'cancellation_reason'  => $m['cancellation_reason'] ?? null,
        'is_policy_violation'  => (bool)($m['is_policy_violation'] ?? 0),
    ],
    'slots'           => $slots,
    'waiting_list'    => $waiting_list,
    'user_in_match'      => $mySlotData,
    'pending_for_me'     => $pendingForMe,
    'my_pending_request' => $myPendingRequest,
    'my_waitlist_entry'  => $myWaitlistEntry,
    'is_creator'         => (int)$m['creator_id'] === $uid,
    'player_eligible'    => ($myPoints >= (int)$m['eligible_min'] && $myPoints <= (int)$m['eligible_max']) && ($m['gender_type'] === 'open' || $m['gender_type'] === 'mixed' || $myGender === $m['creator_gender']),
    'eligibility_reason' => (function() use ($myPoints, $m, $myGender) {
        if ($myPoints < (int)$m['eligible_min'] || $myPoints > (int)$m['eligible_max']) {
            return "Your level (" . $myPoints . " pts) is outside the required range (" . (int)$m['eligible_min'] . " - " . (int)$m['eligible_max'] . " pts).";
        }
        if (!($m['gender_type'] === 'open' || $m['gender_type'] === 'mixed' || $myGender === $m['creator_gender'])) {
            $genderStr = ($m['creator_gender'] === 'female') ? 'Women' : 'Men';
            return "This match is for " . $genderStr . " only.";
        }
        return null;
    })(),
    'user_playing_side'  => $user_playing_side,
    'late_withdrawal'    => $lateWithdrawal,
    'unread_count'       => $unreadCount,
    'scores'             => $scores,
    'disputes'           => $disputes,
    'viewer_id'          => $uid,
    'viewer_gender'      => $myGender,
]);


