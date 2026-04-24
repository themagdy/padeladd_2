<?php
/**
 * Refactored to match the new schema and provide data for DashboardController.
 * Now using bulk fetching to avoid N+1 queries and MySQL server gone away crashes.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

// Fetch matches where user is a participant or has an active waiting list entry
$stmt = $pdo->prepare("
    SELECT m.*
    FROM matches m
    WHERE m.id IN (
        SELECT match_id FROM match_players WHERE user_id = ?
        UNION
        SELECT match_id FROM waiting_list WHERE (requester_id = ? OR partner_id = ?) AND request_status IN ('pending', 'approved')
    )
    AND m.status != 'cancelled'
    ORDER BY m.match_datetime DESC
    LIMIT 50
");
$stmt->execute([$uid, $uid, $uid]);
$matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

$result = [];

if (empty($matches)) {
    jsonResponse(true, 'User matches loaded.', ['matches' => []]);
}

$matchIds = array_map(fn($m) => (int)$m['id'], $matches);
$matchIdsStr = implode(',', $matchIds);

// Bulk fetch players
$pStmt = $pdo->prepare("
    SELECT mp.match_id, mp.team_no, mp.slot_no, mp.user_id, u.first_name, u.last_name, up.nickname
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
        $cutoff    = time() - (6 * 3600); // 6 hours ago
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
            'name' => $p['nickname'] ?: ($p['first_name'] . ' ' . $p['last_name'])
        ];
        if ($p['team_no'] == 1) {
            $teamA[] = $pData;
        } else {
            $teamB[] = $pData;
        }
        
        if ($p['user_id'] == $uid) {
            $userTeam = $p['team_no'] == 1 ? 'a' : 'b';
        }
    }

    // Ensure they have 2 slots each (placeholder if empty)
    while (count($teamA) < 2) $teamA[] = ['name' => null];
    while (count($teamB) < 2) $teamB[] = ['name' => null];

    $result[] = [
        'id'             => $mid,
        'match_code'     => $m['match_code'],
        'venue'          => $m['venue_name'],
        'scheduled_at'   => $m['match_datetime'],
        'status'         => $status,
        'original_status' => $m['status'],
        'team_a'         => $teamA,
        'team_b'         => $teamB,
        'score_a'        => null,
        'score_b'        => null,
        'winner_team'    => null,
        'user_team'      => $userTeam
    ];
}

jsonResponse(true, 'User matches loaded.', ['matches' => $result]);
?>
