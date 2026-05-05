<?php
require_once __DIR__ . '/../backend/core/db.php';
$pdo = getDB();

// Find match ID for M-U554
$matchCode = 'U554';
$stmt = $pdo->prepare("SELECT id FROM matches WHERE match_code = ? OR CONCAT('M-', id) = ?");
$stmt->execute([$matchCode, "M-U554"]);
$matchId = $stmt->fetchColumn();

if ($matchId) {
    $pdo->exec("DELETE FROM match_scores WHERE match_id = $matchId");
    echo "Deleted scores for match $matchId (M-U554)\n";
} else {
    echo "Match M-U554 not found\n";
}
?>
