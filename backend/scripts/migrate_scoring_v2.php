<?php
/**
 * migrate_scoring_v2.php
 * One-time migration for the new scoring & eligibility system.
 *
 * 1. Adds eligible_min, eligible_max columns to matches
 * 2. Adds reminder_sent column to scores
 * 3. Backfills eligible_min/max on all existing matches
 * 4. Resets player_stats.points based on user_profiles.level
 */

require_once __DIR__ . '/../core/db.php';
$pdo = getDB();

echo "=== Padeladd Scoring v2 Migration ===\n\n";

// ── 1. Add eligible_min / eligible_max to matches ─────────────────────────
echo "1. Adding eligible_min, eligible_max to matches table...\n";
$cols = $pdo->query("SHOW COLUMNS FROM matches LIKE 'eligible_min'")->fetchAll();
if (empty($cols)) {
    $pdo->exec("ALTER TABLE matches ADD COLUMN eligible_min INT NOT NULL DEFAULT 0 AFTER match_type");
    $pdo->exec("ALTER TABLE matches ADD COLUMN eligible_max INT NOT NULL DEFAULT 9999 AFTER eligible_min");
    echo "   ✅ Columns added.\n";
} else {
    echo "   ⏭  Columns already exist. Skipping.\n";
}

// ── 2. Add reminder_sent to scores ────────────────────────────────────────
echo "\n2. Adding reminder_sent to scores table...\n";
$cols = $pdo->query("SHOW COLUMNS FROM scores LIKE 'reminder_sent'")->fetchAll();
if (empty($cols)) {
    $pdo->exec("ALTER TABLE scores ADD COLUMN reminder_sent TINYINT(1) NOT NULL DEFAULT 0 AFTER status");
    echo "   ✅ Column added.\n";
} else {
    echo "   ⏭  Column already exists. Skipping.\n";
}

// ── 3. Backfill eligible_min / eligible_max on existing matches ───────────
echo "\n3. Backfilling eligible_min / eligible_max on existing matches...\n";

// Fetch all matches with their creator's current points and match_type
$matchStmt = $pdo->query("
    SELECT m.id, m.match_type, m.creator_id
    FROM matches m
");
$matches = $matchStmt->fetchAll(PDO::FETCH_ASSOC);

$updMatch = $pdo->prepare("UPDATE matches SET eligible_min = ?, eligible_max = ? WHERE id = ?");
$statsCache = [];

$updated = 0;
foreach ($matches as $m) {
    $cid = (int)$m['creator_id'];
    if (!isset($statsCache[$cid])) {
        $s = $pdo->prepare("SELECT points FROM player_stats WHERE user_id = ?");
        $s->execute([$cid]);
        $row = $s->fetch();
        $statsCache[$cid] = $row ? (int)$row['points'] : 100; // default to beginner
    }
    $creatorPoints = $statsCache[$cid];
    $range = ($m['match_type'] === 'competition') ? 100 : 300;
    $min   = max(0, $creatorPoints - $range);
    $max   = $creatorPoints + $range;
    $updMatch->execute([$min, $max, $m['id']]);
    $updated++;
}
echo "   ✅ Updated $updated matches.\n";

// ── 4. Reset player points based on level ─────────────────────────────────
echo "\n4. Resetting player_stats.points based on user_profiles.level...\n";

$levelPoints = [
    'beginner'                 => 100,
    'initiation_intermediate'  => 250,
    'intermediate'             => 400,
    'intermediate_high'        => 550,
    'advanced'                 => 700,
    'competition'              => 850,
    'professional'             => 1000,
];

$profileStmt = $pdo->query("SELECT user_id, level FROM user_profiles");
$profiles = $profileStmt->fetchAll(PDO::FETCH_ASSOC);

$updPoints = $pdo->prepare("
    INSERT INTO player_stats (user_id, points)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE points = VALUES(points)
");

$resetCount = 0;
foreach ($profiles as $p) {
    $level = trim($p['level'] ?? '');
    $pts   = $levelPoints[$level] ?? 100;
    $updPoints->execute([(int)$p['user_id'], $pts]);
    $resetCount++;
}
echo "   ✅ Reset $resetCount player stats records.\n";

echo "\n=== Migration Complete ===\n";
