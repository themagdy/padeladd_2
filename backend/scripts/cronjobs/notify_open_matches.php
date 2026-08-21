<?php
/**
 * Notify Open Matches Script
 * Designed to be run as a cronjob (e.g. every 1 hour or 6 hours) or triggered via Admin Panel.
 * Aggregates available open matches per player and sends a single summary notification.
 */

require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/notification_helper.php';

// Set timezone to match system
date_default_timezone_set('Africa/Cairo');

try {
    $pdo = getDB();

    // 1. Fetch all upcoming open matches with open slots (> 30 minutes in the future)
    $stmtMatches = $pdo->query("
        SELECT 
            m.id,
            m.match_code,
            m.match_datetime,
            m.gender_type,
            m.eligible_min,
            m.eligible_max,
            MAX(up_creator.gender) AS creator_gender,
            COALESCE(MAX(v.name), 'Padel Court') AS venue_name,
            COUNT(mp.id) AS confirmed_count
        FROM matches m
        LEFT JOIN venues v ON m.venue_id = v.id
        LEFT JOIN user_profiles up_creator ON m.creator_id = up_creator.user_id
        LEFT JOIN match_players mp ON m.id = mp.match_id AND mp.status = 'confirmed'
        WHERE m.status = 'open'
          AND m.match_datetime > DATE_ADD(NOW(), INTERVAL 30 MINUTE)
        GROUP BY m.id, m.match_code, m.match_datetime, m.gender_type, m.eligible_min, m.eligible_max
        HAVING confirmed_count < 4
        ORDER BY m.match_datetime ASC
    ");

    $openMatches = $stmtMatches->fetchAll(PDO::FETCH_ASSOC);
    if (empty($openMatches)) {
        echo "No open matches available for notifications.\n";
        return;
    }

    // 2. Fetch active players who have NOT received an availability alert in the last 24 hours
    $playersStmt = $pdo->query("
        SELECT u.id, up.gender, (ps.rank_points + ps.current_buffer) AS pts
        FROM users u
        JOIN user_profiles up ON u.id = up.user_id
        JOIN player_stats ps ON u.id = ps.user_id
        WHERE u.status = 'active'
          -- Exclude players already confirmed in ANY upcoming match
          AND u.id NOT IN (
              SELECT mp.user_id 
              FROM match_players mp
              JOIN matches m ON mp.match_id = m.id
              WHERE m.match_datetime > NOW() AND mp.status = 'confirmed'
          )
          -- Exclude players on ANY upcoming match waiting list
          AND u.id NOT IN (
              SELECT wl.requester_id 
              FROM waiting_list wl
              JOIN matches m ON wl.match_id = m.id
              WHERE m.match_datetime > NOW() AND wl.request_status IN ('pending', 'approved')
          )
          AND u.id NOT IN (
              SELECT COALESCE(wl.partner_id, 0)
              FROM waiting_list wl
              JOIN matches m ON wl.match_id = m.id
              WHERE m.match_datetime > NOW() AND wl.request_status IN ('pending', 'approved')
          )
        /*  AND u.id NOT IN (
              SELECT user_id FROM notifications 
              WHERE type = 'availability_alert' 
                AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
          ) */
    ");
    $players = $playersStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($players)) {
        echo "All active players were already notified within 24 hours.\n";
        return;
    }

    // Pre-fetch player match participations and waiting list entries
    $userParticipationsStmt = $pdo->query("SELECT user_id, match_id FROM match_players");
    $userParticipations = [];
    foreach ($userParticipationsStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $userParticipations[(int)$row['user_id']][(int)$row['match_id']] = true;
    }

    $waitlistStmt = $pdo->query("SELECT requester_id, match_id FROM waiting_list WHERE request_status IN ('pending', 'approved')");
    foreach ($waitlistStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $userParticipations[(int)$row['requester_id']][(int)$row['match_id']] = true;
    }

    $totalNotified = 0;

    foreach ($players as $p) {
        $userId = (int)$p['id'];
        $userGender = $p['gender'];
        $userPts = (int)$p['pts'];

        $eligibleMatches = [];

        foreach ($openMatches as $m) {
            $mid = (int)$m['id'];

            // Skip if player is already in this match or waiting list
            if (isset($userParticipations[$userId][$mid])) continue;

            // Check points range
            $minPts = (int)($m['eligible_min'] ?? 0);
            $maxPts = (int)($m['eligible_max'] ?? 2000);
            if ($userPts < $minPts || $userPts > $maxPts) continue;

            // Check gender requirements
            if ($m['gender_type'] === 'same_gender') {
                $creatorGender = $m['creator_gender'] ?: 'male';
                if ($userGender !== $creatorGender) continue;
            }

            $eligibleMatches[] = $m;
        }

        $cnt = count($eligibleMatches);
        if ($cnt === 0) continue;

        // Build single summary message per player
        if ($cnt === 1) {
            $topMatch = $eligibleMatches[0];
            $shortVenue = trim(explode('/', $topMatch['venue_name'])[0]);
            $matchTime = date('D @ g:i A', strtotime($topMatch['match_datetime']));
            $msg = "Spot available at {$shortVenue} on {$matchTime}";
            $refId = (int)$topMatch['id'];
        } else {
            $msg = "You have {$cnt} open matches available to join!";
            $refId = null; // Navigates directly to Play tab (/matches)
        }

        createNotification($pdo, $userId, 'availability_alert', $refId, $msg, ADMIN_SYSTEM_USER_ID);
        $totalNotified++;
    }

    echo "Successfully sent aggregated open match alerts to {$totalNotified} players across " . count($openMatches) . " open matches.\n";

} catch (Exception $e) {
    error_log("Notify Open Matches Cron Error: " . $e->getMessage());
    echo "Error: " . $e->getMessage() . "\n";
}
