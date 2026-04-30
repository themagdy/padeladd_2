<?php
/**
 * POST /api/score/submit
 * Submits a match score.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

$match_id = (int)($data['match_id'] ?? 0);
$s1_t1 = (int)($data['s1_t1'] ?? 0);
$s1_t2 = (int)($data['s1_t2'] ?? 0);
$s2_t1 = (int)($data['s2_t1'] ?? 0);
$s2_t2 = (int)($data['s2_t2'] ?? 0);
$s3_t1 = (int)($data['s3_t1'] ?? 0);
$s3_t2 = (int)($data['s3_t2'] ?? 0);
$composition = $data['composition'] ?? null; // Optional: array of {user_id, team_no, slot_no}

if ($match_id <= 0) {
    jsonResponse(false, 'Match ID is required.', null, 422);
}

// Score Validation
function isValidSet($t1, $t2) {
    if ($t1 === 0 && $t2 === 0) return null;
    return ($t1 === 6 && $t2 <= 4) || ($t1 === 7 && ($t2 === 5 || $t2 === 6)) ||
           ($t2 === 6 && $t1 <= 4) || ($t2 === 7 && ($t1 === 5 || $t1 === 6));
}

$w1 = isValidSet($s1_t1, $s1_t2);
$w2 = isValidSet($s2_t1, $s2_t2);
$w3 = isValidSet($s3_t1, $s3_t2);

if ($w1 === false) jsonResponse(false, 'Invalid Set 1 score.', null, 422);
if ($w2 === false) jsonResponse(false, 'Invalid Set 2 score.', null, 422);
if ($w3 === false) jsonResponse(false, 'Invalid Set 3 score.', null, 422);

if (!$w1) jsonResponse(false, 'Set 1 is required.', null, 422);
if ($w1 && !$w2) jsonResponse(false, 'Set 2 is required.', null, 422);

$team1Sets = ($s1_t1 > $s1_t2 ? 1 : 0) + ($s2_t1 > $s2_t2 ? 1 : 0) + ($s3_t1 > $s3_t2 ? 1 : 0);
$team2Sets = ($s1_t2 > $s1_t1 ? 1 : 0) + ($s2_t2 > $s2_t1 ? 1 : 0) + ($s3_t2 > $s3_t1 ? 1 : 0);

if ($team1Sets < 2 && $team2Sets < 2) {
    jsonResponse(false, 'Match must have a winner (2 sets won).', null, 422);
}


// 1. Fetch match and check status/time
$stmt = $pdo->prepare("SELECT * FROM matches WHERE id = ?");
$stmt->execute([$match_id]);
$match = $stmt->fetch();

if (!$match) {
    jsonResponse(false, 'Match not found.', null, 404);
}

if ($match['status'] === 'cancelled') {
    jsonResponse(false, 'Cannot submit score for a cancelled match.', null, 400);
}

// Only allow scoring if the match reached 'full' or 'completed' status.
// 'Incomplete' matches (past and still open) cannot be scored.
if ($match['status'] !== 'full' && $match['status'] !== 'completed') {
    jsonResponse(false, 'Only full (2v2) matches can be scored.', null, 400);
}

// Cannot submit before match time
if (strtotime($match['match_datetime']) > time()) {
    jsonResponse(false, 'Cannot submit score before match time.', null, 400);
}

// 2. Check if user is a participant
$playerStmt = $pdo->prepare("SELECT * FROM match_players WHERE match_id = ? AND user_id = ?");
$playerStmt->execute([$match_id, $uid]);
$mySlot = $playerStmt->fetch();

if (!$mySlot) {
    jsonResponse(false, 'Only match participants can submit scores.', null, 403);
}

// 3. Max 5 submissions check
$countStmt = $pdo->prepare("SELECT COUNT(*) FROM scores WHERE match_id = ?");
$countStmt->execute([$match_id]);
if ((int)$countStmt->fetchColumn() >= 5) {
    jsonResponse(false, 'Maximum of 5 match results allowed per session.', null, 400);
}

// (Check removed to allow multiple match results in one session as per the "Max 5" rule)

// 5. Insert score
$pdo->beginTransaction();
try {
    $ins = $pdo->prepare("
        INSERT INTO scores (match_id, submitted_by_user_id, t1_set1, t2_set1, t1_set2, t2_set2, t1_set3, t2_set3, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    ");
    $ins->execute([$match_id, $uid, $s1_t1, $s1_t2, $s2_t1, $s2_t2, $s3_t1, $s3_t2]);
    $score_id = $pdo->lastInsertId();

    // Handle composition switch if provided
    if ($composition && is_array($composition)) {
        // We'll store the suggested composition in a new column or just handle it at approval.
        // The brief says "it's optional to switch teams/partners while submission".
        // I'll add a column 'composition_json' to the scores table to store this.
        $updateComp = $pdo->prepare("UPDATE scores SET composition_json = ? WHERE id = ?");
        $updateComp->execute([json_encode($composition), $score_id]);
    }

    $pdo->commit();

    // 6. Notify others
    // Get player's name for notification
    $meStmt = $pdo->prepare("SELECT u.first_name, u.last_name, up.nickname FROM users u LEFT JOIN user_profiles up ON u.id = up.user_id WHERE u.id = ?");
    $meStmt->execute([$uid]);
    $me = $meStmt->fetch();
    $myName = getDisplayName($me);

    $msg = "{$myName} submitted a score for your match. Please review and approve.";
    notifyMatchParticipants($pdo, $match_id, 'score_submitted', $msg, $uid);

    jsonResponse(true, 'Score submitted successfully. Pending opponent approval.', ['score_id' => $score_id]);

} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(false, 'Failed to submit score: ' . $e->getMessage(), null, 500);
}
