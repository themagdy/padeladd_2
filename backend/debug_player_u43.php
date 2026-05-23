<?php
require_once __DIR__ . '/core/db.php';

$pdo = getDB();

echo "=== USER INFO FOR U43 ===\n";
$stmt = $pdo->prepare("SELECT user_id, nickname, player_code, gender FROM user_profiles WHERE player_code = 'U43'");
$stmt->execute();
$u43 = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$u43) {
    echo "Player U43 not found in user_profiles.\n";
    // Search case insensitively
    $stmt = $pdo->prepare("SELECT user_id, nickname, player_code, gender FROM user_profiles WHERE UPPER(player_code) = 'U43'");
    $stmt->execute();
    $u43 = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($u43) {
        echo "Found case-insensitive: " . json_encode($u43) . "\n";
    } else {
        // List a few players to see formatting
        echo "Example players:\n";
        foreach ($pdo->query("SELECT user_id, player_code, nickname FROM user_profiles LIMIT 5")->fetchAll(PDO::FETCH_ASSOC) as $row) {
            echo " - ID: {$row['user_id']}, Code: {$row['player_code']}, Nick: {$row['nickname']}\n";
        }
        exit;
    }
} else {
    echo json_encode($u43, JSON_PRETTY_PRINT) . "\n";
}

$u43_id = $u43['user_id'];

echo "\n=== MATCH M-H640 INFO ===\n";
$stmt = $pdo->prepare("SELECT * FROM matches WHERE match_code = 'M-H640'");
$stmt->execute();
$match = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$match) {
    echo "Match M-H640 not found.\n";
    exit;
}
echo json_encode($match, JSON_PRETTY_PRINT) . "\n";

$match_id = $match['id'];

echo "\n=== MATCH PLAYERS FOR M-H640 ===\n";
$stmt = $pdo->prepare("
    SELECT mp.*, up.player_code, up.nickname 
    FROM match_players mp 
    JOIN user_profiles up ON mp.user_id = up.user_id 
    WHERE mp.match_id = ?
");
$stmt->execute([$match_id]);
$players = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($players, JSON_PRETTY_PRINT) . "\n";

echo "\n=== SCORES FOR M-H640 ===\n";
$stmt = $pdo->prepare("SELECT * FROM scores WHERE match_id = ?");
$stmt->execute([$match_id]);
$scores = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($scores, JSON_PRETTY_PRINT) . "\n";

echo "\n=== IS U43 IN MATCH PLAYERS FOR THIS MATCH? ===\n";
$stmt = $pdo->prepare("SELECT * FROM match_players WHERE match_id = ? AND user_id = ?");
$stmt->execute([$match_id, $u43_id]);
$res = $stmt->fetch(PDO::FETCH_ASSOC);
echo json_encode($res, JSON_PRETTY_PRINT) . "\n";
?>
