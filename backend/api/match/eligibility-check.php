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
        $stats[$pid] = ['points' => 50, 'matches_played' => 0];
    }
}

// ── Helper: PlayerMatchScore (integer-only) ───────────────────────────────
function playerMatchScore(int $points, int $matches_played): int {
    $confidence = min(100, 5 * $matches_played);           // confidence_i = min(100, 5 * M_i)
    return intdiv($points * (300 + $confidence), 400);       // floor((P_i * (300 + C_i)) / 400)
}

// ── Helper: Anti-farming IntegrityFactor ─────────────────────────────────
function integrityFactor($pdo, int $user_id, array $opponent_ids): int {
    $count = 0;
    foreach ($opponent_ids as $opp_id) {
        $stmt = $pdo->prepare("
            SELECT COUNT(s.id)
            FROM scores s
            JOIN matches m ON s.match_id = m.id
            JOIN match_players mp1 ON m.id = mp1.match_id
            JOIN match_players mp2 ON m.id = mp2.match_id
            WHERE s.status = 'approved'
              AND m.match_type = 'competition'
              AND mp1.user_id = ?
              AND mp2.user_id = ?
              AND mp1.team_no != mp2.team_no
              AND m.match_datetime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ");
        $stmt->execute([$user_id, $opp_id]);
        $count = max($count, (int)$stmt->fetchColumn());
    }

    if ($count < 2)   return 100;
    if ($count == 2)  return 70;
    if ($count == 3)  return 50;
    return 30;
}

// ── Calculate team match scores ───────────────────────────────────────────
$teamAIds = array_map('intval', $team_a);
$teamBIds = array_map('intval', $team_b);

$scoreA1 = playerMatchScore($stats[$teamAIds[0]]['points'], $stats[$teamAIds[0]]['matches_played']);
$scoreA2 = playerMatchScore($stats[$teamAIds[1]]['points'], $stats[$teamAIds[1]]['matches_played']);
$scoreB1 = playerMatchScore($stats[$teamBIds[0]]['points'], $stats[$teamBIds[0]]['matches_played']);
$scoreB2 = playerMatchScore($stats[$teamBIds[1]]['points'], $stats[$teamBIds[1]]['matches_played']);

$teamScoreA = intdiv($scoreA1 + $scoreA2, 2);  // floor avg
$teamScoreB = intdiv($scoreB1 + $scoreB2, 2);

// ── Eligibility check ─────────────────────────────────────────────────────
$gap       = abs($teamScoreA - $teamScoreB);
$maxScore  = max($teamScoreA, $teamScoreB);
$tolerance = 8 + intdiv($maxScore * 15, 100);  // 8 + floor((max * 15) / 100)
$eligible  = ($gap <= $tolerance);

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
    'tolerance'      => $tolerance,
    'player_scores'  => [
        $teamAIds[0] => $scoreA1,
        $teamAIds[1] => $scoreA2,
        $teamBIds[0] => $scoreB1,
        $teamBIds[1] => $scoreB2,
    ],
    'integrity_factors' => [
        $teamAIds[0] => $integrityA1,
        $teamAIds[1] => $integrityA2,
        $teamBIds[0] => $integrityB1,
        $teamBIds[1] => $integrityB2,
    ],
]);
