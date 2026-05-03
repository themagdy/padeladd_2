<?php
/**
 * Script to generate 100 upcoming matches for player Q848
 * Run this in your browser: /temp_scripts/create_test_matches.php
 */

require_once __DIR__ . '/../backend/core/db.php';

$pdo = getDB();
$playerCode = 'Q848';

// 1. Find user ID
$stmt = $pdo->prepare("SELECT user_id FROM user_profiles WHERE player_code = ?");
$stmt->execute([$playerCode]);
$uid = $stmt->fetchColumn();

if (!$uid) {
    die("Error: Player code $playerCode not found.");
}

// 2. Fetch player points for eligibility
$ptsStmt = $pdo->prepare("SELECT current_buffer, rank_points FROM player_stats WHERE user_id = ?");
$ptsStmt->execute([$uid]);
$ptsRow = $ptsStmt->fetch();
$points = (int)($ptsRow['rank_points'] ?? 0) + (int)($ptsRow['current_buffer'] ?? 100);

$eligible_min = max(0, $points - 100);
$eligible_max = $points + 100;

echo "Found User ID: $uid. Starting generation of 100 matches...<br>";

$venueName = "TEST_PAGINATION";
$count = 0;

for ($i = 1; $i <= 100; $i++) {
    $matchCode = "T" . str_pad($i, 3, '0', STR_PAD_LEFT);
    // Varied future dates: starting from 2 days from now, every 2 hours
    $hours = 48 + ($i * 2);
    $date = date('Y-m-d H:i:s', strtotime("+$hours hours"));
    
    try {
        $pdo->beginTransaction();
        
        // Insert Match
        $stmt = $pdo->prepare("
            INSERT INTO matches (creator_id, venue_id, court_name, match_datetime, duration_minutes, status, match_code, gender_type, match_type, eligible_min, eligible_max)
            VALUES (?, 1, ?, ?, 90, 'open', ?, 'open', 'competition', ?, ?)
        ");
        $stmt->execute([$uid, "Court " . ($i % 5 + 1), $date, $matchCode, $eligible_min, $eligible_max]);
        $matchId = $pdo->lastInsertId();
        
        // Add Creator
        $ins = $pdo->prepare("
            INSERT INTO match_players (match_id, user_id, team_no, slot_no, join_type, status)
            VALUES (?, ?, 1, 1, 'creator', 'confirmed')
        ");
        $ins->execute([$matchId, $uid]);
        
        $pdo->commit();
        $count++;
    } catch (Exception $e) {
        $pdo->rollBack();
        echo "Error creating match $i: " . $e->getMessage() . "<br>";
    }
}

echo "Successfully created $count matches with venue '$venueName'.";
