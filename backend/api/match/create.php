<?php
/**
 * POST /api/match/create
 * Creates a new match. Creator occupies team 1, slot 1.
 * If created_with_partner is true, the partner occupies team 1, slot 2 (confirmed immediately).
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$venue_name           = trim($data['venue_name'] ?? '');
$court_name           = trim($data['court_name'] ?? '');
$match_datetime       = trim($data['match_datetime'] ?? '');
$created_with_partner = !empty($data['partner_player_code']) ? 1 : 0;
$partner_code         = strtoupper(trim($data['partner_player_code'] ?? ''));
$duration_minutes     = (int)($data['duration_minutes'] ?? 90);
$gender_type          = trim($data['gender_type'] ?? 'same_gender');
$match_type           = trim($data['match_type'] ?? 'competition');

if (!in_array($gender_type, ['open', 'same_gender'])) $gender_type = 'same_gender';
if (!in_array($match_type, ['friendly', 'competition'])) $match_type = 'competition';
// Fetch creator's side and points
$ups = $pdo->prepare("SELECT up.playing_side, COALESCE(ps.points, 100) AS points FROM user_profiles up LEFT JOIN player_stats ps ON up.user_id = ps.user_id WHERE up.user_id = ?");
$ups->execute([$uid]);
$upRow = $ups->fetch();
$creator_side   = $upRow ? $upRow['playing_side'] : 'flexible';
$creator_points = $upRow ? (int)$upRow['points'] : 100;

// Compute locked eligibility range
$elig_range  = ($match_type === 'competition') ? 100 : 300;
$eligible_min = max(0, $creator_points - $elig_range);
$eligible_max = $creator_points + $elig_range;

// --- Validation ---

if ($venue_name === '') {
    jsonResponse(false, 'Venue name is required.', null, 422);
}
if ($court_name === '') {
    jsonResponse(false, 'Court name or number is required.', null, 422);
}
if ($match_datetime === '') {
    jsonResponse(false, 'Match date and time are required.', null, 422);
}
$dt = DateTime::createFromFormat('Y-m-d\TH:i', $match_datetime);
if (!$dt || $dt <= new DateTime()) {
    jsonResponse(false, 'Match date must be in the future.', null, 422);
}

// Resolve partner if provided
$partner_id = null;
if ($created_with_partner && $partner_code !== '') {
    $ps = $pdo->prepare("SELECT up.user_id FROM user_profiles up WHERE up.player_code = ?");
    $ps->execute([$partner_code]);
    $partnerRow = $ps->fetch();
    if (!$partnerRow) {
        jsonResponse(false, 'Partner player code not found.', null, 404);
    }
    if ($partnerRow['user_id'] === $uid) {
        jsonResponse(false, 'You cannot add yourself as a partner.', null, 422);
    }
    $partner_id = (int)$partnerRow['user_id'];
}

function generateMatchCode($pdo) {
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    while (true) {
        $letter = $chars[rand(0, 25)];
        $num = rand(100, 999);
        $code = "M-" . $letter . $num;
        
        $chk = $pdo->prepare("SELECT id FROM matches WHERE match_code = ?");
        $chk->execute([$code]);
        if (!$chk->fetch()) return $code;
    }
}

try {
    $pdo->beginTransaction();

    $match_code = generateMatchCode($pdo);

    $matchStatus = $created_with_partner ? 'on_hold' : 'open';

    // Insert match with locked eligibility range
    $stmt = $pdo->prepare("
        INSERT INTO matches (creator_id, venue_name, court_name, match_datetime, duration_minutes, created_with_partner, status, match_code, gender_type, match_type, eligible_min, eligible_max)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$uid, $venue_name, $court_name ?: null, $dt->format('Y-m-d H:i:s'), $duration_minutes, $created_with_partner, $matchStatus, $match_code, $gender_type, $match_type, $eligible_min, $eligible_max]);

    $match_id = (int)$pdo->lastInsertId();

    // Creator → team 1, slot 1
    $ins = $pdo->prepare("
        INSERT INTO match_players (match_id, user_id, team_no, slot_no, join_type, status, playing_side)
        VALUES (?, ?, 1, 1, 'creator', 'confirmed', ?)
    ");
    $ins->execute([$match_id, $uid, $creator_side]);

    // Ensure creator has a player_stats row (starting points = 100 for beginners)
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, points, rank_points) VALUES (?, 100, 50)")->execute([$uid]);

    // Partner -> Send invite to waiting_list instead of confirming directly
    if ($partner_id !== null) {
        $insWL = $pdo->prepare("
            INSERT INTO waiting_list (match_id, requester_id, partner_id, request_status)
            VALUES (?, ?, ?, 'pending')
        ");
        $insWL->execute([$match_id, $uid, $partner_id]);

        // Phase 6: Notify partner that they were invited
        $requesterName = getDisplayName($user);
        createNotification($pdo, $partner_id, 'team_invite', $match_id, "{$requesterName} invited you to join a match as their partner", $uid);
    }

    $pdo->commit();
    jsonResponse(true, 'Match created successfully.', ['match_id' => $match_id, 'match_code' => $match_code]);

} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(false, 'Failed to create match: ' . $e->getMessage(), null, 500);
}
