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
        $phone = trim($input['phone'] ?? '');
        $points = (int)($input['rank_points'] ?? 0);
        $buffer = (int)($input['current_buffer'] ?? 0);
        $matchesLeft = (int)($input['buffer_matches_left'] ?? 0);
        $status = $input['account_status'] ?? 'active';
        $nickname = $input['nickname'] ?? '';
        $gender = $input['gender'] ?? 'male';

        $pdo->beginTransaction();

        // 1. Update Users (Name, Email, Phone, Status)
        $stmtUser = $pdo->prepare("
            UPDATE users 
            SET first_name = ?, last_name = ?, email = ?, phone = ?, status = ? 
            WHERE id = ?
        ");
        $stmtUser->execute([$firstName, $lastName, $email, $phone ?: null, $status, $userId]);

        // 2. Update User Profiles (Nickname, Gender)
        $stmtProfile = $pdo->prepare("
            UPDATE user_profiles 
            SET nickname = ?, gender = ? 
            WHERE user_id = ?
        ");
        $stmtProfile->execute([$nickname, $gender, $userId]);

        // Optional: Remove avatar
        $removeAvatar = (int)($input['remove_avatar'] ?? 0);
        if ($removeAvatar === 1) {
            $pdo->prepare("UPDATE user_profiles SET profile_image = NULL, profile_image_thumb = NULL WHERE user_id = ?")
                ->execute([$userId]);
        }

        require_once __DIR__ . '/../../../helpers/ranking_helper.php';

        // Get old points and buffer for logging
        $oldStatsQuery = $pdo->prepare("SELECT rank_points, current_buffer FROM player_stats WHERE user_id = ?");
        $oldStatsQuery->execute([$userId]);
        $oldStats = $oldStatsQuery->fetch(PDO::FETCH_ASSOC);
        $points_before = $oldStats ? (int)($oldStats['rank_points'] ?? 0) : 0;
        $buffer_before = $oldStats ? (int)($oldStats['current_buffer'] ?? 0) : 0;

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

        // Log points change if there is a difference in points or buffer
        if ($points !== $points_before || (int)$buffer !== $buffer_before) {
            logPlayerPointsChange($pdo, (int)$userId, null, $points_before, $points, $points - $points_before, (int)$buffer, 'admin_override');
        }

        $pdo->commit();
        jsonResponse(true, 'Player updated successfully.');
    } 
    else if ($action === 'toggle_status') {
        $newStatus = $input['status'] ?? 'active'; // 'active' or 'banned'
        if (!in_array($newStatus, ['active', 'banned', 'suspended'])) {
            jsonResponse(false, 'Invalid status.', null, 400);
        }
        $stmt = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
        $stmt->execute([$newStatus, $userId]);
        jsonResponse(true, 'Player account status updated.');
    }
    else if ($action === 'toggle_suspension') {
        // Lightweight suspension: blocks join/create match but account remains active otherwise.
        // Status values: 'active' <-> 'suspended'
        $currentStmt = $pdo->prepare("SELECT status FROM users WHERE id = ?");
        $currentStmt->execute([$userId]);
        $row = $currentStmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            jsonResponse(false, 'Player not found.', null, 404);
        }
        if ($row['status'] === 'banned') {
            jsonResponse(false, 'This player is banned. Unban them before changing suspension status.', null, 409);
        }
        $newStatus = ($row['status'] === 'suspended') ? 'active' : 'suspended';
        $pdo->prepare("UPDATE users SET status = ? WHERE id = ?")->execute([$newStatus, $userId]);
        jsonResponse(true, 'Player suspension updated.', ['new_status' => $newStatus]);
    } 
    else {
        jsonResponse(false, 'Invalid action.', null, 400);
    }
} catch (PDOException $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
}
