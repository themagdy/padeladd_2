<?php
/**
 * ranking_helper.php
 * Implements the Phase 7 integer-only ranking logic.
 */

const RANK_SCALE = 1000000000000;

function calculateRankingUpdates(PDO $pdo, int $match_id, int $score_id) {
    // 1. Fetch score and determine winner
    $scoreStmt = $pdo->prepare("SELECT * FROM scores WHERE id = ?");
    $scoreStmt->execute([$score_id]);
    $score = $scoreStmt->fetch();

    if (!$score) throw new Exception("Score record not found.");

    // Calculate sets won
    $t1_sets = 0;
    $t2_sets = 0;
    $t1_games = 0;
    $t2_games = 0;

    for ($i = 1; $i <= 3; $i++) {
        $g1 = (int)$score["t1_set$i"];
        $g2 = (int)$score["t2_set$i"];
        if ($g1 === 0 && $g2 === 0) continue;
        
        $t1_games += $g1;
        $t2_games += $g2;
        if ($g1 > $g2) $t1_sets++;
        else if ($g2 > $g1) $t2_sets++;
    }

    $winner_team = ($t1_sets > $t2_sets) ? 1 : 2;
    $loser_team = ($winner_team === 1) ? 2 : 1;
    $losing_games = ($winner_team === 1) ? $t2_games : $t1_games;

    // Heavy loss flag H
    $H = ($losing_games <= 2) ? 1 : 0;

    // 2. Determine player composition
    // Check if score has a custom composition
    $composition = null;
    if (!empty($score['composition_json'])) {
        $composition = json_decode($score['composition_json'], true);
    }

    if ($composition) {
        // Update match_players to reflect actual teams from the submitted composition
        foreach ($composition as $c) {
            $upd = $pdo->prepare("UPDATE match_players SET team_no = ?, slot_no = ? WHERE match_id = ? AND user_id = ?");
            $upd->execute([$c['team_no'], $c['slot_no'], $match_id, $c['user_id']]);
        }
    }

    // 3. Fetch all 4 players and their stats
    $playersStmt = $pdo->prepare("
        SELECT mp.user_id, mp.team_no, ps.*
        FROM match_players mp
        JOIN player_stats ps ON mp.user_id = ps.user_id
        WHERE mp.match_id = ?
    ");
    $playersStmt->execute([$match_id]);
    $players = $playersStmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($players) < 4) throw new Exception("Match does not have 4 players with stats.");

    // Group players by team
    $team1 = [];
    $team2 = [];
    foreach ($players as $p) {
        if ($p['team_no'] == 1) $team1[] = $p;
        else $team2[] = $p;
    }

    if (count($team1) !== 2 || count($team2) !== 2) {
         throw new Exception("Invalid team composition (Team 1: " . count($team1) . ", Team 2: " . count($team2) . ")");
    }

    // 4. Team-level values
    $TA = (int)floor(($team1[0]['points'] + $team1[1]['points']) / 2);
    $TB = (int)floor(($team2[0]['points'] + $team2[1]['points']) / 2);
    $D = abs($TA - $TB);

    // Match Factors
    $MatchFactorWin = 100;
    $MatchFactorLoss = 100;

    $higher_rated_team = ($TA >= $TB) ? 1 : 2;

    if ($winner_team !== $higher_rated_team) {
        // Lower-rated team wins
        $MatchFactorWin = min(250, 100 + 5 * $D);
        $MatchFactorLoss = min(250, 100 + 5 * $D); // Higher-rated team loses
    } else {
        // Higher-rated team wins
        $MatchFactorWin = max(60, 100 - 2 * $D);
        $MatchFactorLoss = max(60, 100 - 2 * $D); // Lower-rated team loses
    }

    $HeavyWinFactor = 100 + 10 * $H;
    $HeavyLossFactor = 100 + 25 * $H;

    // 5. Loop through each player to calculate their individual Delta
    foreach ($players as &$p) {
        $isWinner = ($p['team_no'] == $winner_team);
        
        // Player stats
        $WR = $p['win_rate'];
        $ST = $p['streak'];
        $M  = $p['matches_played'];

        // WRFactor
        $WRFactor = min(120, max(80, 100 + (50 - $WR)));

        // StreakFactor
        if ($isWinner) {
            $StreakFactor = min(120, max(85, 100 - 4 * $ST));
        } else {
            $StreakFactor = min(120, max(85, 100 + 4 * $ST));
        }

        // NewFactor
        $NewFactor = max(100, 220 - 6 * $M);

        // IntegrityFactor (Anti-farming)
        $IntegrityFactor = calculateIntegrityFactor($pdo, $p['user_id'], $match_id);

        // Final Delta
        if ($isWinner) {
            $delta = (int)floor((8 * $MatchFactorWin * $HeavyWinFactor * $WRFactor * $StreakFactor * $NewFactor * $IntegrityFactor) / RANK_SCALE);
            $p['new_points'] = $p['points'] + $delta;
            $p['delta'] = $delta;
            $p['won'] = true;
        } else {
            $delta = (int)floor((6 * $MatchFactorLoss * $HeavyLossFactor * $WRFactor * $StreakFactor * $NewFactor * $IntegrityFactor) / RANK_SCALE);
            $p['new_points'] = $p['points'] - $delta;
            $p['delta'] = -$delta;
            $p['won'] = false;
        }
    }

    // 6. Update database for each player
    foreach ($players as $p) {
        $new_matches = $p['matches_played'] + 1;
        $new_wins = $p['matches_won'] + ($p['won'] ? 1 : 0);
        $new_losses = $p['matches_lost'] + ($p['won'] ? 0 : 1);
        $new_win_rate = (int)floor(($new_wins * 100) / $new_matches);
        
        // Streak update
        if ($p['won']) {
            $new_streak = ($p['streak'] >= 0) ? ($p['streak'] + 1) : 1;
        } else {
            $new_streak = ($p['streak'] <= 0) ? ($p['streak'] - 1) : -1;
        }

        $upd = $pdo->prepare("
            UPDATE player_stats 
            SET points = ?, 
                matches_played = ?, 
                matches_won = ?, 
                matches_lost = ?, 
                win_rate = ?, 
                streak = ?,
                points_this_week = points_this_week + ?,
                updated_at = NOW()
            WHERE user_id = ?
        ");
        $upd->execute([
            $p['new_points'],
            $new_matches,
            $new_wins,
            $new_losses,
            $new_win_rate,
            $new_streak,
            $p['delta'],
            $p['user_id']
        ]);
    }

    // Mark match as completed
    $mUpd = $pdo->prepare("UPDATE matches SET status = 'completed' WHERE id = ?");
    $mUpd->execute([$match_id]);

    return $players;
}

function calculateIntegrityFactor(PDO $pdo, int $user_id, int $match_id): int {
    // Fetch opponents for this user in this match
    $stmt = $pdo->prepare("SELECT team_no FROM match_players WHERE match_id = ? AND user_id = ?");
    $stmt->execute([$match_id, $user_id]);
    $myTeam = $stmt->fetchColumn();
    
    $oppStmt = $pdo->prepare("SELECT user_id FROM match_players WHERE match_id = ? AND team_no != ?");
    $oppStmt->execute([$match_id, $myTeam]);
    $opponents = $oppStmt->fetchAll(PDO::FETCH_COLUMN);

    if (count($opponents) < 2) return 100;

    // Count matches against these opponents in the last 30 days
    $count = 0;
    foreach ($opponents as $opp_id) {
        $checkStmt = $pdo->prepare("
            SELECT COUNT(DISTINCT m.id)
            FROM matches m
            JOIN match_players mp1 ON m.id = mp1.match_id
            JOIN match_players mp2 ON m.id = mp2.match_id
            WHERE m.status = 'completed'
              AND m.id != ?
              AND mp1.user_id = ?
              AND mp2.user_id = ?
              AND m.match_datetime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ");
        $checkStmt->execute([$match_id, $user_id, $opp_id]);
        $count = max($count, (int)$checkStmt->fetchColumn());
    }

    // Rules:
    // 1st and 2nd time -> 100 (this counts previous matches, so if count is 0 or 1, it's the 1st or 2nd time)
    if ($count < 2) return 100;
    if ($count == 2) return 75; // 3rd time
    if ($count == 3) return 50; // 4th time
    return 25; // 5th time or more
}
