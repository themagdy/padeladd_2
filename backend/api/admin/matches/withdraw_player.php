<?php
/**
 * POST /api/admin/matches/withdraw_player
 * Admin-only: Forcefully withdraw any player from an upcoming match.
 */
require_once __DIR__ . '/../../../helpers/auth_helper.php';
require_once __DIR__ . '/../../../helpers/notif_helper.php';

$pdo = getDB();

// Admin Auth check
$admin_token = $_GET['admin_token'] ?? '';
if (empty($admin_token)) {
    jsonResponse(false, 'Admin token required.');
}

$stmt = $pdo->prepare("SELECT id FROM admins WHERE token = ?");
$stmt->execute([$admin_token]);
$admin = $stmt->fetch();

if (!$admin) {
    jsonResponse(false, 'Unauthorized admin.');
}

$data = json_decode(file_get_contents('php://input'), true);
$match_id = isset($data['match_id']) ? (int)$data['match_id'] : 0;
$user_id  = isset($data['user_id'])  ? (int)$data['user_id']  : 0;

if ($match_id <= 0 || $user_id <= 0) {
    jsonResponse(false, 'match_id and user_id are required.');
}

try {
    $pdo->beginTransaction();

    // Lock match row
    $mStmt = $pdo->prepare("SELECT * FROM matches WHERE id = ? FOR UPDATE");
    $mStmt->execute([$match_id]);
    $match = $mStmt->fetch(PDO::FETCH_ASSOC);

    if (!$match) {
        throw new Exception('Match not found.');
    }

    if (in_array($match['status'], ['completed', 'cancelled'])) {
        throw new Exception('Cannot withdraw from a completed or cancelled match.');
    }

    // Fetch the player's slot
    $slotStmt = $pdo->prepare("SELECT * FROM match_players WHERE match_id = ? AND user_id = ?");
    $slotStmt->execute([$match_id, $user_id]);
    $slot = $slotStmt->fetch(PDO::FETCH_ASSOC);

    if (!$slot) {
        throw new Exception('Player is not in this match.');
    }

    // Check if it is a team withdrawal
    $isTeamJoin = ($slot['join_type'] === 'team');
    $affectedUsers = [$user_id];
    $displacedPartnerId = 0;

    if ($isTeamJoin) {
        $partnerStmt = $pdo->prepare("
            SELECT user_id FROM match_players 
            WHERE match_id = ? AND team_no = ? AND join_type = 'team' AND user_id != ?
        ");
        $partnerStmt->execute([$match_id, $slot['team_no'], $user_id]);
        $partner = $partnerStmt->fetch(PDO::FETCH_ASSOC);
        if ($partner) {
            $displacedPartnerId = (int)$partner['user_id'];
            $affectedUsers[] = $displacedPartnerId;
        }
    }

    // Remove slots
    $placeholders = implode(',', array_fill(0, count($affectedUsers), '?'));
    $pdo->prepare("DELETE FROM match_players WHERE match_id = ? AND user_id IN ($placeholders)")
        ->execute(array_merge([$match_id], $affectedUsers));

    // Cancel any waitlist entries
    $pdo->prepare("
        UPDATE waiting_list 
        SET request_status = 'cancelled' 
        WHERE match_id = ? AND request_status IN ('pending','approved','joined')
          AND (requester_id IN ($placeholders) OR partner_id IN ($placeholders))
    ")->execute(array_merge([$match_id], $affectedUsers, $affectedUsers));

    // Revert match status if it was full
    if ($match['status'] === 'full') {
        $pdo->prepare("UPDATE matches SET status = 'open' WHERE id = ?")->execute([$match_id]);
    }

    // Audit Log
    $eventType = $isTeamJoin ? 'team_withdrawn' : 'player_withdrawn';
    $eventData = json_encode([
        'withdrawn_by' => 'admin',
        'admin_id' => $admin['id'],
        'affected_users' => $affectedUsers
    ]);

    $pdo->prepare("INSERT INTO match_events (match_id, user_id, event_type, event_data) VALUES (?, ?, ?, ?)")
        ->execute([$match_id, $user_id, $eventType, $eventData]);

    $pdo->commit();

    // Notifications
    $notifMsg = "You have been removed from the match by an administrator.";
    foreach ($affectedUsers as $uid) {
        createNotification($pdo, $uid, 'player_withdrawn', $match_id, $notifMsg, 0);
    }
    
    // Notify other participants
    $playerStmt = $pdo->prepare("SELECT nickname FROM user_profiles WHERE user_id = ?");
    $playerStmt->execute([$user_id]);
    $playerInfo = $playerStmt->fetch();
    $pName = $playerInfo['nickname'] ?? 'A player';
    
    $broadcastMsg = $isTeamJoin ? "{$pName} and their partner were removed from the match by admin." : "{$pName} was removed from the match by admin.";
    notifyMatchParticipants($pdo, $match_id, 'player_withdrawn', $broadcastMsg, 0);

    // Notify waitlist availability
    notifyWaitlistAvailability($pdo, $match_id, 'solo', 0);
    if ($isTeamJoin) {
        notifyWaitlistAvailability($pdo, $match_id, 'team', 0);
    }

    jsonResponse(true, 'Player withdrawn successfully.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    jsonResponse(false, $e->getMessage());
}
