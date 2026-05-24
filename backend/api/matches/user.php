<?php
/**
 * Refactored to match the new schema and provide data for DashboardController.
 * Now using bulk fetching to avoid N+1 queries and MySQL server gone away crashes.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

$target_id = null;
if (isset($data['player_code'])) {
    $playerCode = strtoupper(trim($data['player_code']));
    $stmtFind = $pdo->prepare("SELECT user_id FROM user_profiles WHERE player_code = ?");
    $stmtFind->execute([$playerCode]);
    $found = $stmtFind->fetch();
    if ($found) {
        $target_id = (int)$found['user_id'];
    } else {
        jsonResponse(true, 'User matches loaded.', ['matches' => [], 'has_more' => false, 'offset' => 0]);
    }
}

if ($target_id === null) {
    $target_id = (int)($data['target_id'] ?? $data['user_id'] ?? $uid);
}

$limit = (int)($data['limit'] ?? 20);
$offset = (int)($data['offset'] ?? 0);

// Fetch total count for pagination
$countStmt = $pdo->prepare("
    SELECT COUNT(*) FROM matches m
    WHERE (
        -- Condition A: User was a confirmed participant
        m.id IN (SELECT match_id FROM match_players WHERE user_id = :uid1)
        OR
        -- Condition B: User is on waiting list
        (
            m.id IN (SELECT match_id FROM waiting_list WHERE (requester_id = :uid2 OR partner_id = :uid3) AND request_status IN ('pending', 'approved'))
            AND m.status NOT IN ('completed', 'cancelled')
            AND m.match_datetime > DATE_SUB(NOW(), INTERVAL 4 HOUR)
        )
    )
    AND m.status != 'cancelled'
");
$countStmt->execute([
    ':uid1' => $target_id,
    ':uid2' => $target_id,
    ':uid3' => $target_id
]);
$totalMatches = (int)$countStmt->fetchColumn();

// Fetch matches where user is a participant OR an active waiting list entry (with LIMIT and OFFSET)
$stmt = $pdo->prepare("
    SELECT m.*, v.name AS official_venue_name
    FROM matches m
    LEFT JOIN venues v ON m.venue_id = v.id
    WHERE (
        -- Condition A: User was a confirmed participant (Always show)
        m.id IN (SELECT match_id FROM match_players WHERE user_id = :uid1)
        OR
        -- Condition B: User is on waiting list (Only show if match is upcoming/open)
        (
            m.id IN (SELECT match_id FROM waiting_list WHERE (requester_id = :uid2 OR partner_id = :uid3) AND request_status IN ('pending', 'approved'))
            AND m.status NOT IN ('completed', 'cancelled')
            AND m.match_datetime > DATE_SUB(NOW(), INTERVAL 4 HOUR)
        )
    )
    AND m.status != 'cancelled'
    ORDER BY m.match_datetime DESC
    LIMIT :limit OFFSET :offset
");
$stmt->bindValue(':uid1', $target_id, PDO::PARAM_INT);
$stmt->bindValue(':uid2', $target_id, PDO::PARAM_INT);
$stmt->bindValue(':uid3', $target_id, PDO::PARAM_INT);
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

$result = [];

if (empty($matches)) {
    jsonResponse(true, 'User matches loaded.', [
        'matches' => [],
        'has_more' => false,
        'offset' => $offset
    ]);
}

$matchIds = array_map(fn($m) => (int)$m['id'], $matches);
$matchIdsStr = implode(',', $matchIds);

// Bulk fetch scores (approved or pending for the user's matches)
$sStmt = $pdo->prepare("
    SELECT * FROM scores 
    WHERE match_id IN ($matchIdsStr) AND (status = 'approved' OR status = 'pending')
    ORDER BY created_at ASC
");
$sStmt->execute();
$allScores = $sStmt->fetchAll(PDO::FETCH_ASSOC);
$scoresByMatch = [];
foreach ($allScores as $s) {
    $scoresByMatch[$s['match_id']][] = mapScoreComposition($s);
}

// Bulk fetch players
$pStmt = $pdo->prepare("
    SELECT mp.match_id, mp.team_no, mp.slot_no, mp.user_id, u.first_name, u.last_name, up.nickname, up.player_code
    FROM match_players mp
    JOIN users u ON mp.user_id = u.id
    LEFT JOIN user_profiles up ON mp.user_id = up.user_id
    WHERE mp.match_id IN ($matchIdsStr)
    ORDER BY mp.match_id, mp.team_no, mp.slot_no
");
$pStmt->execute();
$allPlayers = $pStmt->fetchAll(PDO::FETCH_ASSOC);

$playersByMatch = [];
foreach ($allPlayers as $p) {
    $playersByMatch[$p['match_id']][] = $p;
}

// Map the result
foreach ($matches as $m) {
    $mid = (int)$m['id'];
    
    // 1. Map Status for Frontend Badges
    $status = $m['status'];
    if (in_array($m['status'], ['open', 'full', 'on_hold'])) {
        $matchTime = strtotime($m['match_datetime']);
        $cutoff    = time() - (4 * 3600); // 4 hours ago
        if ($matchTime > $cutoff) {
            $status = 'upcoming';
        }
    }

    $matchPlayers = $playersByMatch[$mid] ?? [];
    
    $teamA = [];
    $teamB = [];
    $userTeam = null;

    foreach ($matchPlayers as $p) {
        $pData = [
            'user_id' => $p['user_id'],
            'name'    => $p['nickname'] ?: ($p['first_name'] . ' ' . $p['last_name']),
            'nickname' => $p['nickname'],
            'first_name' => $p['first_name'],
            'last_name'  => $p['last_name'],
            'player_code' => $p['player_code'],
            'team_no' => $p['team_no'],
            'slot_no' => $p['slot_no']
        ];
        if ($p['team_no'] == 1) $teamA[] = $pData;
        else $teamB[] = $pData;
        
        if ($p['user_id'] == $uid) $userTeam = $p['team_no'] == 1 ? 'a' : 'b';
    }

    $score = $scoresByMatch[$mid] ?? null;

    $result[] = [
        'id'             => $mid,
        'match_code'     => $m['match_code'],
        'venue'          => $m['official_venue_name'] ?: 'Venue TBD',
        'scheduled_at'   => $m['match_datetime'],
        'status'         => $status,
        'original_status' => $m['status'],
        'team_a'         => $teamA,
        'team_b'         => $teamB,
        'scores'         => $scoresByMatch[$mid] ?? [],
        'user_team'      => $userTeam,
        'duration_minutes' => (int)($m['duration_minutes'] ?? 0)
    ];
}

$has_more = ($offset + count($result)) < $totalMatches;

jsonResponse(true, 'User matches loaded.', [
    'matches' => $result,
    'has_more' => $has_more,
    'offset' => $offset
]);
?>
