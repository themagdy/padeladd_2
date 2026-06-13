<?php
/**
 * POST /api/admin/matches/details
 * Admin-only: Fetch full match details (including roster, settings, and scores) without player auth checks.
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/score_helper.php';

header('Content-Type: application/json');
validateAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Method not allowed.', null, 405);
}

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true) ?: [];

$match_id = (int) ($data['match_id'] ?? 0);

if ($match_id <= 0) {
    jsonResponse(false, 'match_id is required.', null, 422);
}

$pdo = getDB();
$uid = ADMIN_SYSTEM_USER_ID;

// Fetch match
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
$m = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$m) {
    jsonResponse(false, 'Match not found.', null, 404);
}

// Slot details
$slotStmt = $pdo->prepare("
    SELECT mp.team_no, mp.slot_no, mp.join_type, mp.status, mp.user_id, mp.playing_side,
           u.first_name, u.last_name,
           up.player_code, up.profile_image, up.profile_image_thumb, up.nickname, up.gender,
           IF(m.status IN ('completed', 'cancelled'), COALESCE(mp.rank_points_at_join, ps.rank_points, 0), COALESCE(ps.rank_points, 0)) AS points,
           IF(m.status IN ('completed', 'cancelled'), COALESCE(mp.rank_points_at_join, ps.rank_points, 0), COALESCE(ps.rank_points, 0)) AS rank_points,
           IF(m.status IN ('completed', 'cancelled'), COALESCE(mp.buffer_points_at_join, ps.current_buffer, 0), COALESCE(ps.current_buffer, 0)) AS current_buffer,
           ps.matches_played
    FROM match_players mp
    JOIN matches m ON mp.match_id = m.id
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

// Is admin in match (always false/null)
$mySlotData = null;

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

$scores = [];
foreach ($rawScores as $sc) {
    $scores[] = mapScoreComposition($sc);
}

// Admin always sees disputes
$disputesStmt = $pdo->prepare("SELECT * FROM disputes WHERE match_id = ?");
$disputesStmt->execute([$m['id']]);
$disputes = $disputesStmt->fetchAll(PDO::FETCH_ASSOC);

jsonResponse(true, 'Match details loaded.', [
    'match' => [
        'id' => (int) $m['id'],
        'match_code' => $m['match_code'],
        'venue_name' => $m['official_venue_name'] ?: 'Venue TBD',
        'venue_location_link' => $m['venue_location_link'] ?? null,
        'venue_id' => (int) $m['venue_id'],
        'court_name' => $m['court_name'],
        'match_datetime' => $m['match_datetime'],
        'status' => $m['status'],
        'created_with_partner' => (bool) $m['created_with_partner'],
        'gender_type' => $m['gender_type'],
        'match_type' => $m['match_type'],
        'creator_id' => (int) $m['creator_id'],
        'creator_first_name' => $m['creator_first'],
        'creator_last_name' => $m['creator_last'],
        'creator_name' => trim($m['creator_first'] . ' ' . $m['creator_last']),
        'creator_nickname' => $m['creator_nickname'] ?? null,
        'creator_code' => $m['creator_code'] ?? null,
        'creator_gender' => $m['creator_gender'] ?? 'male',
        'cancellation_reason' => $m['cancellation_reason'] ?? null,
        'is_policy_violation' => (bool) ($m['is_policy_violation'] ?? 0),
        'eligible_min' => (int) ($m['eligible_min'] ?? 0),
        'eligible_max' => (int) ($m['eligible_max'] ?? 0),
        'duration_minutes' => (int) ($m['duration_minutes'] ?? 0),
    ],
    'slots' => $slots,
    'players' => $slots,
    'waiting_list' => $waiting_list,
    'user_in_match' => $mySlotData,
    'pending_for_me' => null,
    'my_pending_request' => null,
    'my_waitlist_entry' => null,
    'is_creator' => false,
    'player_eligible' => true,
    'eligibility_reason' => null,
    'user_playing_side' => 'flexible',
    'late_withdrawal' => null,
    'unread_count' => 0,
    'scores' => $scores,
    'disputes' => $disputes,
    'viewer_id' => $uid,
    'viewer_gender' => 'male',
]);
