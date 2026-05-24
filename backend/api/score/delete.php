<?php
/**
 * POST /api/score/delete
 * Deletes or cancels a pending or disputed score submission.
 */
require_once __DIR__ . '/../../helpers/story_helper.php';

$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

$score_id = (int)($data['score_id'] ?? 0);

if ($score_id <= 0) {
    jsonResponse(false, 'Score ID is required.', null, 422);
}

// 1. Fetch score and lock it for update
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare("SELECT * FROM scores WHERE id = ? FOR UPDATE");
    $stmt->execute([$score_id]);
    $score = $stmt->fetch();

    if (!$score) {
        $pdo->rollBack();
        jsonResponse(false, 'Score record not found.', null, 404);
    }

    // 2. Validate status (must not be approved)
    if ($score['status'] === 'approved') {
        $pdo->rollBack();
        jsonResponse(false, 'Approved scores cannot be deleted.', null, 400);
    }

    // 3. Verify that the requester is the submitter of the score
    if ((int)$score['submitted_by_user_id'] !== $uid) {
        $pdo->rollBack();
        jsonResponse(false, 'Only the player who submitted the score can cancel or delete it.', null, 403);
    }

    $match_id = (int)$score['match_id'];

    // 4. Perform deletions
    // Delete any disputes associated with this score
    $delDisputes = $pdo->prepare("DELETE FROM disputes WHERE score_id = ?");
    $delDisputes->execute([$score_id]);

    // Delete any stories associated with this score
    $delStories = $pdo->prepare("DELETE FROM stories WHERE score_id = ?");
    $delStories->execute([$score_id]);

    // Delete the score itself
    $delScore = $pdo->prepare("DELETE FROM scores WHERE id = ?");
    $delScore->execute([$score_id]);

    // 5. Check if there are any remaining approved scores for this match
    $checkApproved = $pdo->prepare("SELECT COUNT(*) FROM scores WHERE match_id = ? AND status = 'approved'");
    $checkApproved->execute([$match_id]);
    $approvedCount = (int)$checkApproved->fetchColumn();

    if ($approvedCount === 0) {
        // Revert match status back to 'full'
        $updMatch = $pdo->prepare("UPDATE matches SET status = 'full' WHERE id = ?");
        $updMatch->execute([$match_id]);

        // Restore the upcoming story for the match
        StoryHelper::updateMatchStory($pdo, $match_id);
    }

    $pdo->commit();
    jsonResponse(true, 'Score submission cancelled/deleted successfully.');

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Error deleting score #{$score_id}: " . $e->getMessage());
    jsonResponse(false, 'Failed to delete score submission: ' . $e->getMessage(), null, 500);
}
