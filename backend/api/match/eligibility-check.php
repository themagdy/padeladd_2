<?php
/**
 * POST /api/match/eligibility-check
 * Phase 4: Check if two teams are eligible to play based on ranking & integrity model.
 *
 * Accepts:
 *   team_a: [user_id, user_id]
 *   team_b: [user_id, user_id]
 *
 * All math is integer-only as per points_integrity.md.
 * SCALE = 1,000,000,000,000 (used in Phase 7 delta calcs, not needed here).
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);

$team_a = $data['team_a'] ?? [];
$team_b = $data['team_b'] ?? [];

if (count($team_a) !== 2 || count($team_b) !== 2) {
    jsonResponse(false, 'team_a and team_b must each contain exactly 2 user IDs.', null, 422);
}

$allIds = array_map('intval', array_merge($team_a, $team_b));
if (count(array_unique($allIds)) !== 4) {
    jsonResponse(false, 'All 4 player IDs must be unique.', null, 422);
}

// ── Fetch player stats ────────────────────────────────────────────────────
$placeholders = implode(',', array_fill(0, 4, '?'));
$statsStmt = $pdo->prepare("
    SELECT ps.user_id, ps.current_buffer, ps.rank_points, ps.buffer_matches_left, ps.matches_played
    FROM player_stats ps
    WHERE ps.user_id IN ($placeholders)
");
$statsStmt->execute($allIds);
$statsRows = $statsStmt->fetchAll(PDO::FETCH_ASSOC);

// Index by user_id
$stats = [];
foreach ($statsRows as $row) {
    $stats[(int)$row['user_id']] = [
        'points'         => (int)($row['rank_points'] ?? 0) + ((int)($row['buffer_matches_left'] ?? 0) > 0 ? (int)($row['current_buffer'] ?? 100) : 0),
        'matches_played' => (int)$row['matches_played'],
    ];
}

// If any player has no stats row yet, default to starting values
foreach ($allIds as $pid) {
    if (!isset($stats[$pid])) {
        $stats[$pid] = ['points' => 100, 'matches_played' => 0];
    }
}

function integrityFactor($pdo, int $user_id, array $opponent_ids): int {
    if (count($opponent_ids) < 2) return 100;
    $opp_id1 = (int)$opponent_ids[0];
    $opp_id2 = (int)$opponent_ids[1];

    $stmt = $pdo->prepare("
        SELECT COUNT(s.id)
        FROM scores s
        JOIN matches m ON s.match_id = m.id
        WHERE s.status = 'approved'
          AND m.match_type = 'competition'
          AND m.match_datetime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          AND (
            (
              (s.t1_p1_user_id = ? OR s.t1_p2_user_id = ?)
              AND (
                (s.t2_p1_user_id = ? AND s.t2_p2_user_id = ?)
                OR (s.t2_p1_user_id = ? AND s.t2_p2_user_id = ?)
              )
            )
            OR
            (
              (s.t2_p1_user_id = ? OR s.t2_p2_user_id = ?)
              AND (
                (s.t1_p1_user_id = ? AND s.t1_p2_user_id = ?)
                OR (s.t1_p1_user_id = ? AND s.t1_p2_user_id = ?)
              )
            )
          )
    ");
    $stmt->execute([
        $user_id, $user_id, $opp_id1, $opp_id2, $opp_id2, $opp_id1,
        $user_id, $user_id, $opp_id1, $opp_id2, $opp_id2, $opp_id1
    ]);
    $count = (int)$stmt->fetchColumn();

    if ($count < 2)   return 100;
    if ($count == 2)  return 70;
    if ($count == 3)  return 50;
    return 30;
}

// ── Calculate team eligibility ─────────────────────────────────────────────
$teamAIds = array_map('intval', $team_a);
$teamBIds = array_map('intval', $team_b);

$match_type = $data['match_type'] ?? 'competition';

$ptsA1 = $stats[$teamAIds[0]]['points'];
$ptsA2 = $stats[$teamAIds[1]]['points'];
$ptsB1 = $stats[$teamBIds[0]]['points'];
$ptsB2 = $stats[$teamBIds[1]]['points'];

$allPoints = [$ptsA1, $ptsA2, $ptsB1, $ptsB2];

// Check if there is at least one player who could be the creator (i.e., all other players are within range)
$rangeLimit = ($match_type === 'competition') ? 100 : 300;
$hasValidCreator = false;
foreach ($allPoints as $creatorPts) {
    $inRange = true;
    foreach ($allPoints as $pPts) {
        if (abs($pPts - $creatorPts) > $rangeLimit) {
            $inRange = false;
            break;
        }
    }
    if ($inRange) {
        $hasValidCreator = true;
        break;
    }
}

$eligible = $hasValidCreator;

$teamScoreA = intdiv($ptsA1 + $ptsA2, 2);
$teamScoreB = intdiv($ptsB1 + $ptsB2, 2);
$gap = abs($teamScoreA - $teamScoreB);

// For friendly match, also check team average difference <= 300
if ($match_type === 'friendly') {
    if ($gap > 300) {
        $eligible = false;
    }
}

// ── Integrity factors for all 4 players ──────────────────────────────────
$integrityA1 = integrityFactor($pdo, $teamAIds[0], $teamBIds);
$integrityA2 = integrityFactor($pdo, $teamAIds[1], $teamBIds);
$integrityB1 = integrityFactor($pdo, $teamBIds[0], $teamAIds);
$integrityB2 = integrityFactor($pdo, $teamBIds[1], $teamAIds);

// ── Response ──────────────────────────────────────────────────────────────
jsonResponse(true, $eligible ? 'Teams are eligible to play.' : 'Teams are too mismatched.', [
    'eligible'       => $eligible,
    'team_a_score'   => $teamScoreA,
    'team_b_score'   => $teamScoreB,
    'gap'            => $gap,
    'tolerance'      => ($match_type === 'friendly') ? 300 : 100,
    'player_scores'  => [
        $teamAIds[0] => $ptsA1,
        $teamAIds[1] => $ptsA2,
        $teamBIds[0] => $ptsB1,
        $teamBIds[1] => $ptsB2,
    ],
    'integrity_factors' => [
        $teamAIds[0] => $integrityA1,
        $teamAIds[1] => $integrityA2,
        $teamBIds[0] => $integrityB1,
        $teamBIds[1] => $integrityB2,
    ],
]);
