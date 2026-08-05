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

$match_id = (int)$score['match_id'];

// 2. Validate that the approver is in the match and is not the submitter
$playersStmt = $pdo->prepare("SELECT user_id FROM match_players WHERE match_id = ? AND status = 'confirmed'");
$playersStmt->execute([$match_id]);
$matchPlayers = $playersStmt->fetchAll(PDO::FETCH_COLUMN);

if (!in_array($uid, $matchPlayers)) {
    jsonResponse(false, 'Only match participants can approve scores.', null, 403);
}

if ($uid === (int)$score['submitted_by_user_id']) {
    jsonResponse(false, 'You cannot approve a score you submitted yourself.', null, 400);
}

// 3. Approve and check total approval count
$pdo->beginTransaction();
try {
    // Record this player's approval (ignore if duplicate)
    $insApproval = $pdo->prepare("INSERT IGNORE INTO score_approvals (score_id, user_id) VALUES (?, ?)");
    $insApproval->execute([$score_id, $uid]);

    // Count how many unique players have approved this score
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM score_approvals WHERE score_id = ?");
    $countStmt->execute([$score_id]);
    $approvalsCount = (int)$countStmt->fetchColumn();

    $isFinalized = false;
    $updatedPlayers = null;

    if ($approvalsCount >= 3) {
        // Finalize score status to approved
        $upd = $pdo->prepare("UPDATE scores SET status = 'approved', approved_by_user_id = ? WHERE id = ?");
        $upd->execute([$uid, $score_id]);

        // TRIGGER RANKING UPDATE
        $updatedPlayers = calculateRankingUpdates($pdo, $match_id, $score_id);
        $isFinalized = true;
    }

    $pdo->commit();

    // Notify others
    $meStmt = $pdo->prepare("SELECT u.first_name, u.last_name, up.nickname FROM users u LEFT JOIN user_profiles up ON u.id = up.user_id WHERE u.id = ?");
    $meStmt->execute([$uid]);
    $me = $meStmt->fetch();
    $myName = getDisplayName($me);

    if ($isFinalized) {
        $msg = "Score for your match has been verified and finalized. Points have been updated.";
        notifyMatchParticipants($pdo, $match_id, 'score_approved', $msg, $uid);

        // Update automated story
        require_once __DIR__ . '/../../helpers/story_helper.php';
        StoryHelper::createScoreStory($pdo, $match_id);

        jsonResponse(true, 'Score finalized. Rankings updated.', [
            'finalized' => true,
            'approvals_count' => $approvalsCount,
            'players' => $updatedPlayers
        ]);
    } else {
        jsonResponse(true, "Approval recorded. ({$approvalsCount}/3 approvals)", [
            'finalized' => false,
            'approvals_count' => $approvalsCount
        ]);
    }

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Score Approval Error: " . $e->getMessage());
    jsonResponse(false, 'Failed to approve score: ' . $e->getMessage(), null, 500);
}
