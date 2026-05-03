<?php
/**
 * ranking_helper.php
 * Padeladd Scoring v2 — implements the approved brief.
 * Competition matches only. Integer arithmetic throughout.
 */


// ── Level → Starting Points map ───────────────────────────────────────────
const LEVEL_POINTS = [
    'beginner'                => 100,
    'initiation_intermediate' => 250,
    'intermediate'            => 400,
    'intermediate_high'       => 550,
    'advanced'                => 700,
    'competition'             => 850,
    'professional'            => 1000,
];

/**
 * Starting points for a given level string.
 */
function getStartingPoints(string $level): int {
    $key = strtolower(str_replace(' ', '_', trim($level)));
    return LEVEL_POINTS[$key] ?? 100;
}


// ── Strength Difference Adjustment ────────────────────────────────────────
/**
 * Returns the absolute adjustment value (0–3) based on team avg diff.
 * Direction is applied by the caller (+ for upset winner, - for expected winner).
 */
function getStrengthAdj(int $diff): int {
    if ($diff <= 50)  return 0;
    if ($diff <= 100) return 1;
    if ($diff <= 200) return 2;
    return 3;
}


// ── Heavy Win/Loss Modifier ────────────────────────────────────────────────
/**
 * Returns the modifier for the winner (+1) and loser (-1) or 0.
 * Never applies in a 3-set match.
 * Applies if total game diff across played sets >= 7.
 *
 * $sets: array of ['w' => int, 'l' => int] — winner/loser games per set
 * Returns: int (0, 1) — winner gets +value, loser gets -value
 */
function getHeavyModifier(array $sets, bool $wentToThree): int {
    if ($wentToThree) return 0;
    $totalDiff = 0;
    foreach ($sets as $s) {
        $totalDiff += abs($s['w'] - $s['l']);
    }
    return ($totalDiff >= 7) ? 1 : 0;
}


// ── New Player Factor ─────────────────────────────────────────────────────
/**
 * Returns the new player factor (as tenths integer, so 15 = 1.5x) for a player.
 * Based on total approved scores across all matches.
 */
function getNewPlayerFactor(PDO $pdo, int $user_id): float {
    $stmt = $pdo->prepare("
        SELECT COUNT(s.id) AS c
        FROM scores s
        JOIN match_players mp ON s.match_id = mp.match_id
        JOIN matches m ON m.id = mp.match_id
        WHERE mp.user_id = ?
          AND s.status = 'approved'
          AND m.match_type = 'competition'
    ");
    $stmt->execute([$user_id]);
    $count = (int)$stmt->fetchColumn();

    if ($count <= 5)  return 1.5;
    if ($count <= 15) return 1.2;
    return 1.0;
}


// ── Integrity Factor ──────────────────────────────────────────────────────
/**
 * Returns the integrity factor (float) for a player in a given match.
 * Based on how many times this player has faced the same opponents in the last 30 days.
 */
function getIntegrityFactor(PDO $pdo, int $user_id, int $match_id): float {
    // Get opponent IDs (opposing team)
    $myTeamStmt = $pdo->prepare("SELECT team_no FROM match_players WHERE match_id = ? AND user_id = ?");
    $myTeamStmt->execute([$match_id, $user_id]);
    $myTeam = $myTeamStmt->fetchColumn();

    if (!$myTeam) return 1.0;

    $oppStmt = $pdo->prepare("SELECT user_id FROM match_players WHERE match_id = ? AND team_no != ? AND status = 'confirmed'");
    $oppStmt->execute([$match_id, $myTeam]);
    $opponents = $oppStmt->fetchAll(PDO::FETCH_COLUMN);

    if (count($opponents) < 2) return 1.0;

    // Count all approved competition scores against these opponents in last 30 days
    $count = 0;
    foreach ($opponents as $opp_id) {
        $checkStmt = $pdo->prepare("
            SELECT COUNT(s.id)
            FROM scores s
            JOIN matches m ON s.match_id = m.id
            JOIN match_players mp1 ON m.id = mp1.match_id
            JOIN match_players mp2 ON m.id = mp2.match_id
            WHERE s.status = 'approved'
              AND m.match_type = 'competition'
              AND m.id != ?
              AND mp1.user_id = ?
              AND mp2.user_id = ?
              AND mp1.team_no != mp2.team_no
              AND m.match_datetime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ");
        $checkStmt->execute([$match_id, $user_id, $opp_id]);
        $count = max($count, (int)$checkStmt->fetchColumn());
    }

    if ($count < 2)  return 1.0;
    if ($count == 2) return 0.7;
    if ($count == 3) return 0.5;
    return 0.3;
}


// ── Live Rank ─────────────────────────────────────────────────────────────
function getLiveRank(PDO $pdo, int $user_id): ?int {
    $stmt = $pdo->prepare("
        SELECT ps.rank_points, up.gender
        FROM player_stats ps
        JOIN user_profiles up ON ps.user_id = up.user_id
        WHERE ps.user_id = ?
    ");
    $stmt->execute([$user_id]);
    $p = $stmt->fetch();
    if (!$p) return null;

    // Rank = position among players of the same gender by rank_points
    $rankStmt = $pdo->prepare("
        SELECT COUNT(*) + 1
        FROM player_stats ps
        JOIN user_profiles up ON ps.user_id = up.user_id
        WHERE up.gender = ? AND ps.rank_points > ?
    ");
    $rankStmt->execute([$p['gender'], $p['rank_points']]);
    return (int)$rankStmt->fetchColumn();
}


// ── Main Ranking Update ────────────────────────────────────────────────────
/**
 * Calculates and applies point changes after a competition score is approved.
 * Friendly matches: returns empty array immediately (no points).
 *
 * Returns array of player update data for the API response.
 */
function calculateRankingUpdates(PDO $pdo, int $match_id, int $score_id): array {

    // Guard: competition matches only
    $matchStmt = $pdo->prepare("SELECT match_type FROM matches WHERE id = ?");
    $matchStmt->execute([$match_id]);
    $matchRow = $matchStmt->fetch();
    if (!$matchRow || $matchRow['match_type'] !== 'competition') {
        // Mark match completed, no points
        $pdo->prepare("UPDATE matches SET status = 'completed' WHERE id = ?")->execute([$match_id]);
        return [];
    }

    // ── 1. Fetch score ────────────────────────────────────────────────────
    $scoreStmt = $pdo->prepare("SELECT * FROM scores WHERE id = ?");
    $scoreStmt->execute([$score_id]);
    $score = $scoreStmt->fetch();
    if (!$score) throw new Exception("Score record not found.");

    // ── 2. Parse sets ─────────────────────────────────────────────────────
    $sets = [];
    $t1Sets = 0; $t2Sets = 0;
    for ($i = 1; $i <= 3; $i++) {
        $g1 = (int)$score["t1_set$i"];
        $g2 = (int)$score["t2_set$i"];
        if ($g1 === 0 && $g2 === 0 && $i > 1) continue;
        if ($g1 === 0 && $g2 === 0) continue;
        if ($g1 > $g2) $t1Sets++; else if ($g2 > $g1) $t2Sets++;
        $sets[] = ['g1' => $g1, 'g2' => $g2];
    }

    $winner_team = ($t1Sets > $t2Sets) ? 1 : 2;
    $loser_team  = ($winner_team === 1) ? 2 : 1;
    $wentToThree = count($sets) === 3;

    // Build sets in winner/loser perspective for heavy modifier
    $setsForHeavy = array_map(fn($s) => [
        'w' => $winner_team === 1 ? $s['g1'] : $s['g2'],
        'l' => $winner_team === 1 ? $s['g2'] : $s['g1'],
    ], $sets);

    $heavyMod = getHeavyModifier($setsForHeavy, $wentToThree);

    // ── 3. Handle composition ─────────────────────────────────────────────
    if (!empty($score['composition_json'])) {
        $composition = json_decode($score['composition_json'], true);
        if ($composition) {
            foreach ($composition as $c) {
                $pdo->prepare("UPDATE match_players SET team_no = ?, slot_no = ? WHERE match_id = ? AND user_id = ?")
                    ->execute([$c['team_no'], $c['slot_no'], $match_id, $c['user_id']]);
            }
        }
    }

    // ── 4. Fetch all 4 confirmed players ──────────────────────────────────
    $playersStmt = $pdo->prepare("
        SELECT mp.user_id, mp.team_no
        FROM match_players mp
        WHERE mp.match_id = ? AND mp.status = 'confirmed'
    ");
    $playersStmt->execute([$match_id]);
    $participants = $playersStmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($participants) < 4) throw new Exception("Match does not have 4 confirmed players.");

    // Fetch stats
    $players = [];
    foreach ($participants as $part) {
        $psStmt = $pdo->prepare("SELECT * FROM player_stats WHERE user_id = ?");
        $psStmt->execute([$part['user_id']]);
        $ps = $psStmt->fetch(PDO::FETCH_ASSOC);
        if (!$ps) {
            $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, points, rank_points) VALUES (?, 100, 50)")->execute([$part['user_id']]);
            $psStmt->execute([$part['user_id']]);
            $ps = $psStmt->fetch(PDO::FETCH_ASSOC);
        }
        $ps['team_no'] = $part['team_no'];
        $players[] = $ps;
    }

    // Group by team
    $team1 = array_values(array_filter($players, fn($p) => $p['team_no'] == 1));
    $team2 = array_values(array_filter($players, fn($p) => $p['team_no'] == 2));
    if (count($team1) !== 2 || count($team2) !== 2) {
        throw new Exception("Invalid team composition.");
    }

    // ── 5. Team averages & strength adjustment ────────────────────────────
    // Effective Points = Buffer (points) + Competitive (rank_points) - 50
    $teamAvgA = (int)floor((($team1[0]['points'] + $team1[0]['rank_points'] - 50) + ($team1[1]['points'] + $team1[1]['rank_points'] - 50)) / 2);
    $teamAvgB = (int)floor((($team2[0]['points'] + $team2[0]['rank_points'] - 50) + ($team2[1]['points'] + $team2[1]['rank_points'] - 50)) / 2);
    $diff      = abs($teamAvgA - $teamAvgB);
    $adj       = getStrengthAdj($diff);

    // Which team is higher rated?
    $higherTeam = ($teamAvgA >= $teamAvgB) ? 1 : 2;
    $lowerWon   = ($winner_team !== $higherTeam); // upset?

    // ── 6. Per-player delta ───────────────────────────────────────────────
    foreach ($players as &$p) {
        $isWinner = ($p['team_no'] == $winner_team);

        // Strength adj direction
        if ($lowerWon) {
            $strengthAdj = $isWinner ? +$adj : -$adj;  // upset: winner gets bonus, loser penalised extra
        } else {
            $strengthAdj = $isWinner ? -$adj : +$adj;  // expected: winner gets less, loser loses less
        }

        // Base + adj + heavy
        $base    = $isWinner ? +4 : -4;
        $heavy   = $isWinner ? +$heavyMod : -$heavyMod;
        $subtotal = $base + $strengthAdj + $heavy;

        // Factors
        $newFactor    = getNewPlayerFactor($pdo, $p['user_id']);
        $integrityFac = getIntegrityFactor($pdo, $p['user_id'], $match_id);

        // Skip if integrity too low
        if ($integrityFac < 0.5) {
            $p['delta']      = 0;
            $p['new_points'] = $p['points'];
            $p['won']        = $isWinner;
            $p['skipped']    = true;
            continue;
        }

        $change = (int)round($subtotal * $newFactor * $integrityFac);
        $change = max(-15, min(15, $change)); // clamp ±15
        
        // ── BUFFER CONSUMPTION LOGIC (First 20 matches) ──
        $consumedFromBuffer = 0;
        if ((int)$p['buffer_matches_left'] > 0) {
            $initial = (int)$p['initial_buffer'];
            $consumptionAmount = (int)round($initial * 0.05);
            $p['buffer_matches_left'] = (int)$p['buffer_matches_left'] - 1;
            if ($isWinner) {
                $consumedFromBuffer = $consumptionAmount;
            }
            $p['new_eligibility_pts'] = max(0, (int)$p['points'] - $consumptionAmount);
            if ($p['buffer_matches_left'] <= 0) {
                $p['new_eligibility_pts'] = 0;
            }
        } else {
            $p['new_eligibility_pts'] = (int)$p['points'];
        }

        $p['delta']      = $change + $consumedFromBuffer;
        $p['rank_delta'] = $change + $consumedFromBuffer;
        $p['new_points'] = $p['new_eligibility_pts'];
        $p['won']        = $isWinner;
        $p['skipped']    = false;
        $p['old_rank']   = getLiveRank($pdo, $p['user_id']);
    }
    unset($p);

    // ── 7. Update DB ──────────────────────────────────────────────────────
    foreach ($players as $p) {
        $new_matches = (int)$p['matches_played'] + 1;
        $new_wins    = (int)$p['matches_won']  + ($p['won'] ? 1 : 0);
        $new_losses  = (int)$p['matches_lost'] + ($p['won'] ? 0 : 1);
        $new_wr      = (int)floor(($new_wins * 100) / $new_matches);
        $new_streak  = $p['won']
            ? (($p['streak'] >= 0) ? $p['streak'] + 1 : 1)
            : (($p['streak'] <= 0) ? $p['streak'] - 1 : -1);

        $pdo->prepare("
            UPDATE player_stats
            SET points            = ?,
                rank_points       = rank_points + ?,
                initial_buffer    = ?,
                buffer_matches_left = ?,
                matches_played    = ?,
                matches_won       = ?,
                matches_lost      = ?,
                win_rate          = ?,
                streak            = ?,
                points_this_week  = points_this_week + ?,
                previous_ranking  = ?,
                updated_at        = NOW()
            WHERE user_id = ?
        ")->execute([
            $p['new_points'],
            $p['rank_delta'],
            $p['initial_buffer'],
            $p['buffer_matches_left'] ?? 0,
            $new_matches,
            $new_wins,
            $new_losses,
            $new_wr,
            $new_streak,
            $p['rank_delta'],
            $p['old_rank'] ?? null,
            $p['user_id'],
        ]);

        // Track highest ranking
        $newRank = getLiveRank($pdo, $p['user_id']);
        if ($newRank !== null && ($p['highest_ranking'] === null || $newRank < (int)$p['highest_ranking'])) {
            $pdo->prepare("UPDATE player_stats SET highest_ranking = ? WHERE user_id = ?")
                ->execute([$newRank, $p['user_id']]);
        }
    }

    // ── 8. Mark match completed ───────────────────────────────────────────
    $pdo->prepare("UPDATE matches SET status = 'completed' WHERE id = ?")->execute([$match_id]);

    return $players;
}
