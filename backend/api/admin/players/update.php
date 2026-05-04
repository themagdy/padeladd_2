<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Method not allowed.', null, 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$userId = $input['user_id'] ?? null;
$action = $input['action'] ?? ''; // 'update_stats' or 'toggle_status'

if (!$userId) {
    jsonResponse(false, 'User ID required.', null, 400);
}

$pdo = getDB();

try {
    if ($action === 'update_stats') {
        $firstName = $input['first_name'] ?? '';
        $lastName = $input['last_name'] ?? '';
        $email = $input['email'] ?? '';
        $points = (int)($input['rank_points'] ?? 0);
        $buffer = (int)($input['current_buffer'] ?? 0);
        $matchesLeft = (int)($input['buffer_matches_left'] ?? 0);
        $status = $input['account_status'] ?? 'active';
        $nickname = $input['nickname'] ?? '';
        $gender = $input['gender'] ?? 'male';

        $pdo->beginTransaction();

        // 1. Update Users (Name, Email, Status)
        $stmtUser = $pdo->prepare("
            UPDATE users 
            SET first_name = ?, last_name = ?, email = ?, status = ? 
            WHERE id = ?
        ");
        $stmtUser->execute([$firstName, $lastName, $email, $status, $userId]);

        // 2. Update User Profiles (Nickname, Gender)
        $stmtProfile = $pdo->prepare("
            UPDATE user_profiles 
            SET nickname = ?, gender = ? 
            WHERE user_id = ?
        ");
        $stmtProfile->execute([$nickname, $gender, $userId]);

        // 3. Update Player Stats (Points, Buffer)
        // Use INSERT INTO ... ON DUPLICATE KEY UPDATE in case player_stats row doesn't exist yet
        $stmtStats = $pdo->prepare("
            INSERT INTO player_stats (user_id, rank_points, current_buffer, buffer_matches_left)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                rank_points = VALUES(rank_points),
                current_buffer = VALUES(current_buffer),
                buffer_matches_left = VALUES(buffer_matches_left)
        ");
        $stmtStats->execute([$userId, $points, $buffer, $matchesLeft]);

        $pdo->commit();
        jsonResponse(true, 'Player updated successfully.');
    } 
    else if ($action === 'toggle_status') {
        $newStatus = $input['status'] ?? 'active'; // 'active' or 'banned'
        $stmt = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
        $stmt->execute([$newStatus, $userId]);
        jsonResponse(true, 'Player account status updated.');
    } 
    else {
        jsonResponse(false, 'Invalid action.', null, 400);
    }
} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
}
