<?php
/**
 * Match Reminders Script
 * Designed to be run as a cronjob (e.g., every 5 minutes).
 * Sends a push notification to players 2 hours before their match.
 */

require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/notification_helper.php';

// Set timezone to match system
date_default_timezone_set('Africa/Cairo');

try {
    $pdo = getDB();

    // 1. Find confirmed players for matches starting in ~2 hours
    // We look for matches starting between 115 and 125 minutes from now.
    // This ensures that even if the cron runs every 5-10 mins, we catch them.
    $sql = "
        SELECT 
            mp.id as player_record_id,
            mp.user_id,
            mp.match_id,
            m.match_datetime,
            COALESCE(v.name, 'the venue') as venue_name,
            m.court_name
        FROM match_players mp
        JOIN matches m ON mp.match_id = m.id
        LEFT JOIN venues v ON m.venue_id = v.id
        WHERE mp.status = 'confirmed'
          AND mp.reminder_sent = 0
          AND m.status IN ('open', 'full')
          AND m.match_datetime BETWEEN NOW() + INTERVAL 115 MINUTE AND NOW() + INTERVAL 135 MINUTE
    ";

    $stmt = $pdo->query($sql);
    $reminders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($reminders)) {
        echo "No reminders to send in this time window.";
        return;
    }

    $count = 0;
    foreach ($reminders as $r) {
        $matchTime = date('g:i A', strtotime($r['match_datetime']));
        $venue = $r['venue_name'];
        $court = !empty($r['court_name']) ? " ({$r['court_name']})" : "";
        
        $title = "Match Reminder 🎾";
        $body = "Don't forget! You have a match at {$venue}{$court} starting at {$matchTime}. See you there!";

        // Send Notification (This triggers both DB entry and FCM Push)
        createNotification($pdo, (int)$r['user_id'], 'match_reminder', (int)$r['match_id'], $body);

        // Mark as sent to prevent double notification
        $update = $pdo->prepare("UPDATE match_players SET reminder_sent = 1 WHERE id = ?");
        $update->execute([$r['player_record_id']]);
        
        $count++;
    }

    echo "Successfully sent {$count} match reminders.\n";

} catch (Exception $e) {
    error_log("Match Reminders Script Error: " . $e->getMessage());
    echo "Error: " . $e->getMessage() . "\n";
}
