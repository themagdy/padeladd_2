<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/auth_helper.php';

header('Content-Type: application/json');

$pdo = getDB();
$admin = getAuthenticatedUser($pdo);

// Verify admin status
if ($admin['role'] !== 'admin' && $admin['role'] !== 'moderator') {
    jsonResponse(false, 'Unauthorized. Admin access required.', null, 403);
}

$input = json_decode(file_get_contents('php://input'), true);
$playerCode = trim($input['player_code'] ?? '');
$flagType = $input['flag_type'] ?? '';
$reason = trim($input['reason'] ?? '');

if (empty($playerCode) || empty($flagType) || empty($reason)) {
    jsonResponse(false, 'Player code, flag type, and reason are required.');
}

if (!in_array($flagType, ['red', 'green'])) {
    jsonResponse(false, 'Invalid flag type. Use red or green.');
}

try {
    // 1. Find user by player code
    $stmtUser = $pdo->prepare("SELECT user_id FROM user_profiles WHERE player_code = ?");
    $stmtUser->execute([$playerCode]);
    $target = $stmtUser->fetch();

    if (!$target) {
        jsonResponse(false, 'Player with code ' . $playerCode . ' not found.');
    }

    // 2. Insert flag
    $stmtInsert = $pdo->prepare("INSERT INTO player_flags (user_id, flag_type, reason, admin_id) VALUES (?, ?, ?, ?)");
    $stmtInsert->execute([$target['user_id'], $flagType, $reason, $admin['id']]);

    jsonResponse(true, 'Flag logged successfully.');
} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage());
}
?>
