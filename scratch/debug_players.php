<?php
require_once 'backend/core/config.php';
require_once 'backend/core/db.php';

$pdo = getDB();

$stmt = $pdo->prepare("SELECT id FROM matches WHERE status='completed' LIMIT 1");
$stmt->execute();
$match = $stmt->fetch();
if (!$match) die("No completed match found.");

$mid = $match['id'];
echo "Checking match ID: $mid\n";

$pStmt = $pdo->prepare("
    SELECT mp.match_id, mp.team_no, mp.slot_no, mp.user_id, u.first_name, u.last_name, up.nickname, up.player_code
    FROM match_players mp
    JOIN users u ON mp.user_id = u.id
    LEFT JOIN user_profiles up ON mp.user_id = up.user_id
    WHERE mp.match_id = ?
");
$pStmt->execute([$mid]);
$players = $pStmt->fetchAll(PDO::FETCH_ASSOC);
print_r($players);
?>
