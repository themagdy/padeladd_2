<?php
/**
 * auto_confirm_scores.php
 * Cron script: run every 15 minutes.
 * 
 * 1. Sends a 12-hour reminder notification for pending scores
 * 2. Auto-approves scores that have been pending for 24+ hours
 *
 * Cron entry (MAMP, every 15 min):
 *   * /15 * * * * /usr/bin/php /Applications/MAMP/htdocs/padeladd4/backend/scripts/auto_confirm_scores.php >> /tmp/padeladd_cron.log 2>&1
 */

require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/ranking_helper.php';
require_once __DIR__ . '/../../helpers/notification_helper.php';
require_once __DIR__ . '/../../helpers/response.php';

$pdo = getDB();

echo date('[Y-m-d H:i:s]') . " Auto-confirm cron started.\n";

// ── 1. Send 12-hour reminders ─────────────────────────────────────────────
$reminderStmt = $pdo->prepare("
    SELECT s.id, s.match_id, s.submitted_by_user_id
    FROM scores s
    WHERE s.status = 'pending'
      AND s.reminder_sent = 0
      AND s.created_at <= NOW() - INTERVAL 12 HOUR
      AND s.created_at > NOW() - INTERVAL 24 HOUR
");
$reminderStmt->execute();
$toRemind = $reminderStmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($toRemind as $score) {
    // Notify the opposing team (not the submitter) to approve
    $match_id = (int)$score['match_id'];
    $submitter_id = (int)$score['submitted_by_user_id'];

    // Get submitter's team
    $teamStmt = $pdo->prepare("SELECT team_no FROM match_players WHERE match_id = ? AND user_id = ?");
    $teamStmt->execute([$match_id, $submitter_id]);
    $submitterTeam = $teamStmt->fetchColumn();

    if ($submitterTeam) {
        // Fetch opponent player IDs
        $oppStmt = $pdo->prepare("SELECT user_id FROM match_players WHERE match_id = ? AND team_no != ? AND status = 'confirmed'");
        $oppStmt->execute([$match_id, $submitterTeam]);
        $opponents = $oppStmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($opponents as $opp_id) {
            createNotification($pdo, $opp_id, 'score_reminder', $match_id, 
                "Reminder: A score is waiting for your approval. It will be auto-confirmed in 12 hours.", 
                $submitter_id);
        }
    }

    // Mark reminder sent
    $pdo->prepare("UPDATE scores SET reminder_sent = 1 WHERE id = ?")->execute([$score['id']]);
    echo date('[Y-m-d H:i:s]') . " Reminder sent for score #{$score['id']} (match #{$match_id}).\n";
}

// ── 2. Auto-approve scores pending 24+ hours ──────────────────────────────
$autoStmt = $pdo->prepare("
    SELECT s.id, s.match_id, s.submitted_by_user_id
    FROM scores s
    WHERE s.status = 'pending'
      AND s.created_at <= NOW() - INTERVAL 24 HOUR
");
$autoStmt->execute();
$toApprove = $autoStmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($toApprove as $score) {
    $match_id = (int)$score['match_id'];
    $score_id = (int)$score['id'];

    $pdo->beginTransaction();
    try {
        // Mark score approved (auto)
        $pdo->prepare("UPDATE scores SET status = 'approved', approved_by_user_id = NULL WHERE id = ?")
            ->execute([$score_id]);

        // Trigger ranking updates
        calculateRankingUpdates($pdo, $match_id, $score_id);

        $pdo->commit();

        // Notify all participants
        notifyMatchParticipants($pdo, $match_id, 'score_approved', 
            "Score for your match was auto-confirmed after 24 hours. Points have been updated.", 
            null);

        echo date('[Y-m-d H:i:s]') . " Auto-confirmed score #{$score_id} for match #{$match_id}.\n";

    } catch (Exception $e) {
        $pdo->rollBack();
        echo date('[Y-m-d H:i:s]') . " ERROR auto-confirming score #{$score_id}: " . $e->getMessage() . "\n";
    }
}

echo date('[Y-m-d H:i:s]') . " Done. Reminded: " . count($toRemind) . ", Auto-confirmed: " . count($toApprove) . ".\n";
