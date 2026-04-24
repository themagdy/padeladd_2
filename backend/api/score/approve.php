<?php
/**
 * POST /api/score/approve
 * Approves a match score and triggers ranking updates.
 */
require_once __DIR__ . '/../../helpers/ranking_helper.php';

$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

$score_id = (int)($data['score_id'] ?? 0);

if ($score_id <= 0) {
    jsonResponse(false, 'Score ID is required.', null, 422);
}

// 1. Fetch score and match
$stmt = $pdo->prepare("
    SELECT s.*, m.status AS match_status, m.match_datetime
    FROM scores s
    JOIN matches m ON s.match_id = m.id
    WHERE s.id = ?
");
$stmt->execute([$score_id]);
$score = $stmt->fetch();

if (!$score) {
    jsonResponse(false, 'Score record not found.', null, 404);
}

if ($score['status'] !== 'pending') {
    jsonResponse(false, 'This score is not in pending status.', null, 400);
}

if ($score['match_status'] === 'completed') {
    jsonResponse(false, 'A score has already been approved for this match.', null, 400);
}

$match_id = (int)$score['match_id'];

// 2. Validate that the approver is on the opponent team of the submitter
$subTeamNo = null;
$appTeamNo = null;

if ($score['composition_json']) {
    try {
        $comp = json_decode($score['composition_json'], true);
        if (is_array($comp)) {
            foreach ($comp as $entry) {
                if ((int)$entry['user_id'] === (int)$score['submitted_by_user_id']) $subTeamNo = (int)$entry['team_no'];
                if ((int)$entry['user_id'] === $uid) $appTeamNo = (int)$entry['team_no'];
            }
        }
    } catch (Exception $e) {}
}

// Fallback to original slots if composition not found or partial
if ($subTeamNo === null || $appTeamNo === null) {
    $playerStmt = $pdo->prepare("SELECT team_no FROM match_players WHERE match_id = ? AND user_id = ?");
    
    if ($subTeamNo === null) {
        $playerStmt->execute([$match_id, $score['submitted_by_user_id']]);
        $subTeamNo = $playerStmt->fetchColumn();
    }
    
    if ($appTeamNo === null) {
        $playerStmt->execute([$match_id, $uid]);
        $appTeamNo = $playerStmt->fetchColumn();
    }
}

if (!$appTeamNo) {
    jsonResponse(false, 'Only match participants can approve scores.', null, 403);
}

if ($appTeamNo == $subTeamNo) {
    jsonResponse(false, 'Only opponents can approve the submitted score.', null, 403);
}

// 3. Approve and Update Ranking
$pdo->beginTransaction();
try {
    // Update score status
    $upd = $pdo->prepare("UPDATE scores SET status = 'approved', approved_by_user_id = ? WHERE id = ?");
    $upd->execute([$uid, $score_id]);

    // Deny other pending scores for this match (set to disputed)
    $pdo->prepare("UPDATE scores SET status = 'disputed' WHERE match_id = ? AND id != ? AND status = 'pending'")
        ->execute([$match_id, $score_id]);

    // TRIGGER RANKING UPDATE
    $updatedPlayers = calculateRankingUpdates($pdo, $match_id, $score_id);

    $pdo->commit();

    // 4. Notifications
    $meStmt = $pdo->prepare("SELECT u.first_name, u.last_name, up.nickname FROM users u LEFT JOIN user_profiles up ON u.id = up.user_id WHERE u.id = ?");
    $meStmt->execute([$uid]);
    $me = $meStmt->fetch();
    $myName = getDisplayName($me);

    $msg = "Score for your match has been approved! Points have been updated.";
    notifyMatchParticipants($pdo, $match_id, 'score_approved', $msg, $uid);

    jsonResponse(true, 'Score approved. Ranking updated.', [
        'players' => $updatedPlayers
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    error_log("Score Approval Error: " . $e->getMessage());
    jsonResponse(false, 'Failed to approve score: ' . $e->getMessage(), null, 500);
}
