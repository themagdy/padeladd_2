<?php
/**
 * migrate_player_codes.php
 * Identifies player codes with confusing characters (0oS5i1l) or incorrect length
 * and re-generates them using the new logic.
 */

// Since we are running from CLI, we need to mock some globals if needed, 
// but here we just need DB and auth helper.
require_once __DIR__ . '/../core/db.php';
require_once __DIR__ . '/../helpers/auth_helper.php';

$pdo = getDB();

// Regex for confusing characters: 0, o, O, s, S, 5, i, 1, l
// Or length not equal to 4
$badCodesStmt = $pdo->query("
    SELECT user_id, player_code 
    FROM user_profiles 
    WHERE player_code REGEXP '[0oOsS5i1l]' 
       OR LENGTH(player_code) != 4
");
$badCodes = $badCodesStmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found " . count($badCodes) . " accounts with ambiguous or legacy player codes.\n";

$updateStmt = $pdo->prepare("UPDATE user_profiles SET player_code = ? WHERE user_id = ?");

foreach ($badCodes as $row) {
    $uid = (int)$row['user_id'];
    $oldCode = $row['player_code'];
    
    $newCode = generateUniquePlayerCode($pdo);
    
    if ($newCode) {
        $updateStmt->execute([$newCode, $uid]);
        echo "Updating User ID {$uid}: {$oldCode} -> {$newCode}\n";
    } else {
        echo "FAILED to generate new code for User ID {$uid}\n";
    }
}

echo "Migration complete.\n";
