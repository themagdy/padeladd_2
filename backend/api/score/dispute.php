<?php
/**
 * POST /api/score/dispute
 * Disputes a match score.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

$score_id = (int)($data['score_id'] ?? 0);
$reason = trim($data['reason'] ?? '');

if ($score_id <= 0) {
    jsonResponse(false, 'Score ID is required.', null, 422);
}

if (empty($reason)) {
    jsonResponse(false, 'Dispute reason is required.', null, 422);
}

// 1. Fetch score and match
$stmt = $pdo->prepare("SELECT * FROM scores WHERE id = ?");
$stmt->execute([$score_id]);
$score = $stmt->fetch();

if (!$score) {
    jsonResponse(false, 'Score record not found.', null, 404);
}

if ($score['status'] !== 'pending') {
    jsonResponse(false, 'Only pending scores can be disputed.', null, 400);
}

$match_id = (int)$score['match_id'];

// 2. Validate that the disputer is an opponent
$playerStmt = $pdo->prepare("SELECT team_no FROM match_players WHERE match_id = ? AND user_id = ?");

// Submitter's team
$playerStmt->execute([$match_id, $score['submitted_by_user_id']]);
$submitterTeam = $playerStmt->fetchColumn();

// Disputer's team
$playerStmt->execute([$match_id, $uid]);
$disputerTeam = $playerStmt->fetchColumn();

if (!$disputerTeam) {
    jsonResponse(false, 'Only match participants can dispute scores.', null, 403);
}

if ($disputerTeam == $submitterTeam) {
    jsonResponse(false, 'Only opponents can dispute the submitted score.', null, 403);
}

// 3. Update status and record dispute
$pdo->beginTransaction();
try {
    $upd = $pdo->prepare("UPDATE scores SET status = 'disputed' WHERE id = ?");
    $upd->execute([$score_id]);

    $ins = $pdo->prepare("INSERT INTO disputes (match_id, score_id, disputed_by_user_id, reason_text) VALUES (?, ?, ?, ?)");
    $ins->execute([$match_id, $score_id, $uid, $reason]);

    $pdo->commit();

    // 4. Notifications
    $meStmt = $pdo->prepare("SELECT u.first_name, u.last_name, up.nickname FROM users u LEFT JOIN user_profiles up ON u.id = up.user_id WHERE u.id = ?");
    $meStmt->execute([$uid]);
    $me = $meStmt->fetch();
    $myName = getDisplayName($me);

    $msg = "{$myName} disputed the submitted score for your match: \"{$reason}\"";
    notifyMatchParticipants($pdo, $match_id, 'score_disputed', $msg, $uid);

    jsonResponse(true, 'Score disputed successfully.');

} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(false, 'Failed to dispute score: ' . $e->getMessage(), null, 500);
}
