<?php
require_once 'backend/core/config.php';
require_once 'backend/core/db.php';
require_once 'backend/helpers/response.php';

$pdo = getDB();
$playerCode = 'n449';

// 1. Get user by player code
$stmt = $pdo->prepare("SELECT u.*, up.player_code, up.gender FROM users u JOIN user_profiles up ON u.id = up.user_id WHERE up.player_code = ?");
$stmt->execute([$playerCode]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo "User $playerCode not found.\n";
} else {
    echo "User Found: " . $user['first_name'] . " " . $user['last_name'] . " (ID: " . $user['id'] . ", Gender: " . $user['gender'] . ")\n";
}

// 2. Check upcoming matches
$stmt = $pdo->prepare("SELECT id, match_code, match_type, gender_type, status, match_datetime FROM matches WHERE match_datetime > NOW() ORDER BY match_datetime ASC");
$stmt->execute();
$matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "\nUpcoming Matches in DB:\n";
if (empty($matches)) {
    echo "NONE\n";
} else {
    foreach ($matches as $m) {
        echo "ID: {$m['id']} | Code: {$m['match_code']} | Type: {$m['match_type']} | Gender: {$m['gender_type']} | Status: {$m['status']} | Date: {$m['match_datetime']}\n";
    }
}

// 3. Specifically look for friendly matches
$friendly = array_filter($matches, fn($m) => $m['match_type'] === 'friendly');
echo "\nFriendly Matches count: " . count($friendly) . "\n";
foreach ($friendly as $m) {
    echo " - Code: {$m['match_code']} | Date: {$m['match_datetime']}\n";
}
