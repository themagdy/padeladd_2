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
$status_filter = isset($data['status']) ? trim($data['status']) : null;

// Fetch total count for pagination
$countQuery = "
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
";
if ($status_filter) {
    $countQuery .= " AND m.status = :status";
}

$countStmt = $pdo->prepare($countQuery);
$countParams = [
    ':uid1' => $target_id,
    ':uid2' => $target_id,
    ':uid3' => $target_id
];
if ($status_filter) {
    $countParams[':status'] = $status_filter;
}
$countStmt->execute($countParams);
$totalMatches = (int)$countStmt->fetchColumn();

// Fetch matches where user is a participant OR an active waiting list entry (with LIMIT and OFFSET)
$selectQuery = "
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
";
if ($status_filter) {
    $selectQuery .= " AND m.status = :status";
}
$selectQuery .= "
    ORDER BY m.match_datetime DESC
    LIMIT :limit OFFSET :offset
";

$stmt = $pdo->prepare($selectQuery);
$stmt->bindValue(':uid1', $target_id, PDO::PARAM_INT);
$stmt->bindValue(':uid2', $target_id, PDO::PARAM_INT);
$stmt->bindValue(':uid3', $target_id, PDO::PARAM_INT);
if ($status_filter) {
    $stmt->bindValue(':status', $status_filter, PDO::PARAM_STR);
}
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

$scoreIds = array_filter(array_map(fn($s) => (int)$s['id'], $allScores));
$pointChangesByScore = [];
if (!empty($scoreIds)) {
    $scoreIdsStr = implode(',', $scoreIds);
    $logStmt = $pdo->prepare("
        SELECT score_id, user_id, change_amount 
        FROM player_points_log 
        WHERE score_id IN ($scoreIdsStr)
    ");
    $logStmt->execute();
    $logs = $logStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($logs as $l) {
        $pointChangesByScore[(int)$l['score_id']][(int)$l['user_id']] = (int)$l['change_amount'];
    }
}

$scoresByMatch = [];
foreach ($allScores as $s) {
    $mapped = mapScoreComposition($s);
    $mapped['point_changes'] = $pointChangesByScore[(int)$s['id']] ?? (object)[];
    $scoresByMatch[$s['match_id']][] = $mapped;
}

// Bulk fetch players
$pStmt = $pdo->prepare("
    SELECT mp.match_id, mp.team_no, mp.slot_no, mp.user_id, mp.point_change, u.first_name, u.last_name, up.nickname, up.player_code
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
        if ($m['status'] === 'open') {
            if ($matchTime > time()) {
                $status = 'upcoming';
            }
        } else {
            $cutoff = time() - (4 * 3600); // 4 hours ago
            if ($matchTime > $cutoff) {
                $status = 'upcoming';
            }
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
            'slot_no' => $p['slot_no'],
            'point_change' => isset($p['point_change']) ? (int)$p['point_change'] : null
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
        'duration_minutes' => (int)($m['duration_minutes'] ?? 0),
        'match_type'     => $m['match_type'],
        'gender_type'    => $m['gender_type']
    ];
}

$has_more = ($offset + count($result)) < $totalMatches;

function calculatePlayerAchievements(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare("
        SELECT s.*, m.match_datetime
        FROM scores s
        JOIN match_players mp ON s.match_id = mp.match_id
        JOIN matches m ON s.match_id = m.id
        WHERE mp.user_id = ?
          AND s.status = 'approved'
          AND m.match_type = 'competition'
          AND m.match_datetime >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        ORDER BY m.match_datetime ASC, s.created_at ASC
    ");
    $stmt->execute([$userId]);
    $scores = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalCompWins = 0;
    $totalCompPlayed = count($scores);
    $heavyWins = 0;
    $currentStreak = 0;
    $total3Streaks = 0;

    foreach ($scores as $s) {
        $playerTeam = null;
        if ((int)$s['t1_p1_user_id'] === $userId || (int)$s['t1_p2_user_id'] === $userId) {
            $playerTeam = 1;
        } elseif ((int)$s['t2_p1_user_id'] === $userId || (int)$s['t2_p2_user_id'] === $userId) {
            $playerTeam = 2;
        }
        if (!$playerTeam) continue;

        $t1Sets = 0;
        $t2Sets = 0;
        $sets = [];
        for ($i = 1; $i <= 3; $i++) {
            $g1 = (int)$s["t1_set$i"];
            $g2 = (int)$s["t2_set$i"];
            if ($g1 === 0 && $g2 === 0) continue;
            if ($g1 > $g2) $t1Sets++;
            elseif ($g2 > $g1) $t2Sets++;
            $sets[] = ['g1' => $g1, 'g2' => $g2];
        }

        $winnerTeam = ($t1Sets > $t2Sets) ? 1 : 2;
        $userWon = ($playerTeam === $winnerTeam);

        if ($userWon) {
            $totalCompWins++;
            $currentStreak++;
            if ($currentStreak === 3) {
                $total3Streaks++;
            }

            if (count($sets) === 2) {
                $diff = 0;
                foreach ($sets as $set) {
                    $diff += abs($set['g1'] - $set['g2']);
                }
                if ($diff >= 8) {
                    $heavyWins++;
                }
            }
        } else {
            $currentStreak = 0;
        }
    }

    $milestoneTargets = [10, 25, 50, 100, 250, 500];
    $currentTarget = 10;
    foreach ($milestoneTargets as $t) {
        if ($totalCompWins < $t) {
            $currentTarget = $t;
            break;
        }
        $currentTarget = $t;
    }

    return [
        [
            'key'      => 'streak',
            'title'    => 'Hot Streak',
            'icon'     => '🔥',
            'unlocked' => ($currentStreak >= 3),
            'val'      => $currentStreak,
            'desc'     => $currentStreak >= 3 ? "Active {$currentStreak} Win Streak" : "Reach 3 consecutive wins (Current: {$currentStreak})"
        ],
        [
            'key'      => 'streak_master',
            'title'    => 'Streak Master',
            'icon'     => '⚡',
            'unlocked' => ($total3Streaks >= 3),
            'val'      => $total3Streaks,
            'target'   => 3,
            'desc'     => $total3Streaks >= 3 ? "Achieved 3-Win Streak {$total3Streaks}x" : "Achieved 3-Win Streak"
        ],
        [
            'key'      => 'heavy',
            'title'    => 'Heavy Dominator',
            'icon'     => '💥',
            'unlocked' => ($heavyWins >= 3),
            'val'      => $heavyWins,
            'target'   => 3,
            'desc'     => "Heavy Victories (Diff ≥ 8)"
        ],
        [
            'key'      => 'veteran',
            'title'    => 'Comp Veteran',
            'icon'     => '🏆',
            'unlocked' => ($totalCompWins >= 10),
            'val'      => $totalCompWins,
            'target'   => $currentTarget,
            'desc'     => "Competition Wins"
        ],
        [
            'key'      => 'quarterly',
            'title'    => 'Court Machine',
            'icon'     => '🚀',
            'unlocked' => ($totalCompPlayed >= 60),
            'val'      => $totalCompPlayed,
            'target'   => 60,
            'desc'     => "Matches Played"
        ]
    ];
}

jsonResponse(true, 'User matches loaded.', [
    'matches'      => $result,
    'has_more'     => $has_more,
    'offset'       => $offset,
    'achievements' => calculatePlayerAchievements($pdo, $target_id)
]);
?>
