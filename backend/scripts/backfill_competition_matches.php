<?php
/**
 * backfill_competition_matches.php
 *
 * 1. Converts completed friendly matches to competition type
 * 2. Picks the correct approved score per match
 * 3. Runs calculateRankingUpdates() on each using the new v2 formula
 * 4. Resets rank_points to 0 first to avoid double-counting
 */

require_once __DIR__ . '/../core/db.php';
require_once __DIR__ . '/../helpers/ranking_helper.php';

$pdo = getDB();

echo "=== Backfill Competition Matches ===\n\n";

$s = $pdo->query("
    SELECT s.id, s.match_id, s.composition_json
    FROM scores s
    JOIN matches m ON m.id = s.match_id
    WHERE m.status = 'completed' AND s.status = 'approved'
    ORDER BY s.match_id, s.id ASC
");
$rows = $s->fetchAll(PDO::FETCH_ASSOC);

echo "Scores to process: " . implode(', ', array_map(fn($r) => "#{$r['id']} (Match #{$r['match_id']})", $rows)) . "\n\n";

// ── Reset competitive stats for all players ───────────────────────────────
$pdo->exec("UPDATE player_stats SET rank_points = 50, matches_played = 0, matches_won = 0, matches_lost = 0, win_rate = 0, streak = 0");
echo "✅ Reset all competitive stats (rank_points=50, matches=0).\n\n";

// ── Convert matches to competition ───────────────────────────────────────
$matchIds = array_unique(array_map(fn($r) => $r['match_id'], $rows));
if (!empty($matchIds)) {
    $ph = implode(',', $matchIds);
    $pdo->exec("UPDATE matches SET match_type = 'competition' WHERE id IN ($ph)");
    echo "✅ Converted matches [" . implode(', ', $matchIds) . "] to competition.\n\n";
}

// ── Run calculateRankingUpdates per score ─────────────────────────────────
foreach ($rows as $r) {
    $match_id = (int)$r['match_id'];
    $score_id = (int)$r['id'];
    echo "--- Processing Score #{$score_id} (Match #{$match_id}) ---\n";

    // Re-open match status so calculateRankingUpdates can mark it completed
    $pdo->prepare("UPDATE matches SET status = 'completed' WHERE id = ?")->execute([$match_id]);

    try {
        $updates = calculateRankingUpdates($pdo, $match_id, $score_id);
        if (empty($updates)) {
            echo "  ⚠️  No updates returned (check match_type guard or player count).\n";
        } else {
            foreach ($updates as $p) {
                $skipped = $p['skipped'] ?? false;
                if ($skipped) {
                    echo "  ↩  uid={$p['user_id']} SKIPPED (integrity factor too low)\n";
                } else {
                    $sign = $p['delta'] >= 0 ? '+' : '';
                    echo "  ✅ uid={$p['user_id']} " . ($p['won'] ? 'WIN ' : 'LOSS') . " delta={$sign}{$p['delta']} → rank_pts={$p['new_points']}\n";
                }
            }
        }
    } catch (Exception $e) {
        echo "  ❌ ERROR: " . $e->getMessage() . "\n";
    }
    echo "\n";
}

// ── Final state ───────────────────────────────────────────────────────────
echo "=== Final rank_points ===\n";
$final = $pdo->query("
    SELECT up.nickname, ps.points AS eligibility_pts, ps.rank_points
    FROM player_stats ps
    JOIN user_profiles up ON up.user_id = ps.user_id
    ORDER BY ps.rank_points DESC
");
foreach ($final->fetchAll() as $r) {
    echo str_pad($r['nickname'] ?? '?', 15) . " rank_pts=" . str_pad($r['rank_points'], 4) . "  elig_pts=" . $r['eligibility_pts'] . "\n";
}
echo "\n=== Done ===\n";
