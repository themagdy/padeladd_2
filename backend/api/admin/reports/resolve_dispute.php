<?php
/**
 * POST /api/admin/reports/resolve_dispute
 * Admin resolution for score disputes.
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/ranking_helper.php';
require_once __DIR__ . '/../../../helpers/notification_helper.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

$dispute_id = (int)($data['dispute_id'] ?? 0);
$action = $data['action'] ?? ''; // 'approve' or 'reject'

if ($dispute_id <= 0 || !in_array($action, ['approve', 'reject'])) {
    jsonResponse(false, 'Invalid request parameters.', null, 422);
}

// 1. Fetch dispute and related score
$stmt = $pdo->prepare("
    SELECT d.*, s.match_id as score_match_id, s.status as score_status
    FROM disputes d
    JOIN scores s ON d.score_id = s.id
    WHERE d.id = ?
");
$stmt->execute([$dispute_id]);
$dispute = $stmt->fetch();

if (!$dispute) {
    jsonResponse(false, 'Dispute record not found.', null, 404);
}

$score_id = (int)$dispute['score_id'];
$match_id = (int)$dispute['match_id'];

$pdo->beginTransaction();
try {
    if ($action === 'approve') {
        // OVERRIDE: Force approve the score
        $upd = $pdo->prepare("UPDATE scores SET status = 'approved', approved_by_user_id = 0 WHERE id = ?"); // 0 for Admin
        $upd->execute([$score_id]);

        // Trigger Ranking Update
        calculateRankingUpdates($pdo, $match_id, $score_id);

        $msg = "A moderator has reviewed and approved the disputed score for your match. Points have been updated.";
        notifyMatchParticipants($pdo, $match_id, 'score_approved', $msg);
    } else {
        // REJECT: Delete the score record so it can be re-submitted
        $delScore = $pdo->prepare("DELETE FROM scores WHERE id = ?");
        $delScore->execute([$score_id]);

        $msg = "A moderator has rejected the disputed score for your match. Please re-submit the correct score.";
        notifyMatchParticipants($pdo, $match_id, 'score_disputed', $msg);
    }

    // Always delete the dispute record once resolved
    $delDispute = $pdo->prepare("DELETE FROM disputes WHERE id = ?");
    $delDispute->execute([$dispute_id]);

    $pdo->commit();
    jsonResponse(true, "Dispute resolved and score {$action}d.");

} catch (Exception $e) {
    $pdo->rollBack();
    jsonResponse(false, 'Failed to resolve dispute: ' . $e->getMessage(), null, 500);
}
