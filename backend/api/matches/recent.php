<?php
/**
 * matches/recent.php
 * Returns the most recent completed matches across the whole platform.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

$limit = (int)($data['limit'] ?? 10);

// Fetch recent completed matches that have approved scores
$stmt = $pdo->prepare("
    SELECT m.*
    FROM matches m
    WHERE m.status = 'completed'
      AND m.id IN (SELECT match_id FROM scores WHERE status = 'approved')
    ORDER BY m.match_datetime DESC
    LIMIT ?
");
$stmt->execute([$limit]);
$matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

$result = [];

if (empty($matches)) {
    jsonResponse(true, 'No recent matches found.', ['matches' => []]);
}

$matchIds = array_map(fn($m) => (int)$m['id'], $matches);
$matchIdsStr = implode(',', $matchIds);

// Bulk fetch scores (approved)
$sStmt = $pdo->prepare("
    SELECT * FROM scores 
    WHERE match_id IN ($matchIdsStr) AND status = 'approved'
    ORDER BY created_at ASC
");
$sStmt->execute();
$allScores = $sStmt->fetchAll(PDO::FETCH_ASSOC);
$scoresByMatch = [];
foreach ($allScores as $s) {
    $scoresByMatch[$s['match_id']][] = $s;
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
        
        if ((int)$p['user_id'] === $uid) {
            $userTeam = (int)$p['team_no'];
        }
    }

    $result[] = [
        'id'             => $mid,
        'match_code'     => $m['match_code'],
        'match_datetime' => $m['match_datetime'],
        'venue_name'     => $m['venue_name'],
        'court_name'     => $m['court_name'],
        'status'         => 'completed', // Explicitly completed
        'team_a'         => $teamA,
        'team_b'         => $teamB,
        'user_team'      => $userTeam,
        'scores'         => $scoresByMatch[$mid] ?? []
    ];
}

jsonResponse(true, 'Recent matches loaded.', ['matches' => $result]);
