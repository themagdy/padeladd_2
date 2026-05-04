<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/ranking_helper.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();
$matchCode = $_GET['code'] ?? '';

if (empty($matchCode)) {
    jsonResponse(false, 'Match code required.', null, 400);
}

// 1. Fetch Match
$stmt = $pdo->prepare("SELECT m.*, v.name as venue_name FROM matches m LEFT JOIN venues v ON m.venue_id = v.id WHERE m.match_code = ?");
$stmt->execute([$matchCode]);
$match = $stmt->fetch();

if (!$match) {
    jsonResponse(false, 'Match not found.', null, 404);
}

$matchId = $match['id'];

// 2. Fetch Players
$stmt = $pdo->prepare("
    SELECT mp.*, CONCAT(u.first_name, ' ', u.last_name) as full_name, up.nickname, up.player_code, ps.rank_points, ps.current_buffer
    FROM match_players mp
    JOIN users u ON mp.user_id = u.id
    JOIN user_profiles up ON mp.user_id = up.user_id
    LEFT JOIN player_stats ps ON mp.user_id = ps.user_id
    WHERE mp.match_id = ?
");
$stmt->execute([$matchId]);
$players = $stmt->fetchAll();

// 3. Fetch Scores
$stmt = $pdo->prepare("SELECT s.*, u.nickname as submitter_name, u.player_code as submitter_code FROM scores s JOIN user_profiles u ON s.submitted_by_user_id = u.user_id WHERE s.match_id = ? ORDER BY s.created_at DESC");
$stmt->execute([$matchId]);
$scores = $stmt->fetchAll();

// 4. Fetch Disputes
$stmt = $pdo->prepare("SELECT d.*, u.nickname as disputer_name, u.player_code as disputer_code FROM disputes d JOIN user_profiles u ON d.disputed_by_user_id = u.user_id WHERE d.match_id = ?");
$stmt->execute([$matchId]);
$disputes = $stmt->fetchAll();

// 5. Fetch Activity Logs (Unified Timeline)
$logs = [];
$calcLog = []; // Safeguard for response structure

// A. Joins
$stmt = $pdo->prepare("
    SELECT mp.created_at as time, up.nickname as player, up.player_code, 'Joined' as action 
    FROM match_players mp 
    JOIN user_profiles up ON mp.user_id = up.user_id 
    WHERE mp.match_id = ?
");
$stmt->execute([$matchId]);
$logs = array_merge($logs, $stmt->fetchAll(PDO::FETCH_ASSOC));

// B. Withdrawals / Cancellations
$stmt = $pdo->prepare("
    SELECT me.created_at as time, COALESCE(up.nickname, 'System') as player, up.player_code, 
    CASE 
        WHEN me.event_type = 'player_withdrawn' THEN 'Withdrew'
        WHEN me.event_type = 'team_withdrawn' THEN 'Withdrew (Team)'
        WHEN me.event_type = 'match_cancelled' THEN 'Cancelled Match'
        ELSE me.event_type 
    END as action
    FROM match_events me
    LEFT JOIN user_profiles up ON me.user_id = up.user_id
    WHERE me.match_id = ?
");
$stmt->execute([$matchId]);
$logs = array_merge($logs, $stmt->fetchAll(PDO::FETCH_ASSOC));

// C. Waitlist / Invites
$stmt = $pdo->prepare("
    SELECT wl.updated_at as time, up.nickname as player, up.player_code, 
    CASE 
        WHEN wl.request_status = 'joined' THEN 'Accepted Invite'
        WHEN wl.request_status = 'approved' THEN 'Approved to Join'
        ELSE CONCAT('Waitlist: ', wl.request_status)
    END as action
    FROM waiting_list wl
    JOIN user_profiles up ON wl.requester_id = up.user_id
    WHERE wl.match_id = ? AND wl.request_status != 'pending'
");
$stmt->execute([$matchId]);
$logs = array_merge($logs, $stmt->fetchAll(PDO::FETCH_ASSOC));

// D. Chat Messages
$stmt = $pdo->prepare("
    SELECT mc.created_at as time, up.nickname as player, up.player_code, 
    CONCAT('Chat: ', mc.message_text) as action
    FROM chat_messages mc
    JOIN user_profiles up ON mc.user_id = up.user_id
    WHERE mc.match_id = ?
");
$stmt->execute([$matchId]);
$logs = array_merge($logs, $stmt->fetchAll(PDO::FETCH_ASSOC));

// E. Match Creation
$stmt = $pdo->prepare("
    SELECT m.created_at as time, up.nickname as player, up.player_code, 
    CONCAT('Created a ', m.match_type, ' match') as action
    FROM matches m
    JOIN user_profiles up ON m.creator_id = up.user_id
    WHERE m.id = ?
");
$stmt->execute([$matchId]);
$logs = array_merge($logs, $stmt->fetchAll(PDO::FETCH_ASSOC));

// Sort by time
usort($logs, fn($a, $b) => strtotime($a['time']) - strtotime($b['time']));

jsonResponse(true, 'Match data fetched.', [
    'match' => $match,
    'players' => $players,
    'scores' => $scores,
    'disputes' => $disputes,
    'logs' => $logs,
    'calc_simulation' => $calcLog
]);
