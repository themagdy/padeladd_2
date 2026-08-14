<?php
/**
 * Migration 007: Complete Wipe of all matches, scores, notifications, stories, reports & chats
 * Run at: http://localhost:8888/padeladd4/backend/migrations/007_reset_matches_and_rankings.php
 * Or live: https://padeladd.com/backend/migrations/007_reset_matches_and_rankings.php
 */
require_once __DIR__ . '/../core/db.php';
require_once __DIR__ . '/../helpers/ranking_helper.php';

header('Content-Type: application/json');

$pdo = getDB();

try {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

    $tablesToTruncate = [
        'blocked_partner_requests',
        'chat_messages',
        'chat_presence',
        'chat_read_status',
        'disputes',
        'in_app_message_views',
        'match_events',
        'match_players',
        'match_reports',
        'matches',
        'notifications',
        'phone_requests',
        'player_flags',
        'player_points_log',
        'profile_reports',
        'score_approvals',
        'scores',
        'stories',
        'story_seen',
        'system_reports',
        'waiting_list'
    ];

    foreach ($tablesToTruncate as $t) {
        try {
            $pdo->exec("TRUNCATE TABLE `$t`");
        } catch (\Throwable $e) {
            // Ignore if table does not exist
        }
    }

    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    // Reset player_stats and insert initial setup logs
    $players = $pdo->query("
        SELECT ps.user_id, up.level 
        FROM player_stats ps
        LEFT JOIN user_profiles up ON ps.user_id = up.user_id
    ")->fetchAll(PDO::FETCH_ASSOC);

    $resetCount = 0;
    foreach ($players as $st) {
        $uId = (int)$st['user_id'];
        $startingPoints = getStartingPoints($st['level'] ?? 'beginner');

        $upd = $pdo->prepare("
            UPDATE player_stats 
            SET rank_points = 0,
                initial_buffer = ?,
                current_buffer = ?,
                buffer_matches_left = 20,
                matches_played = 0,
                matches_won = 0,
                matches_lost = 0,
                win_rate = 0,
                streak = 0
            WHERE user_id = ?
        ");
        $upd->execute([$startingPoints, $startingPoints, $uId]);

        logPlayerPointsChange($pdo, $uId, null, 0, 0, 0, $startingPoints, 'initial_setup', null);
        $resetCount++;
    }

    echo json_encode([
        'success' => true, 
        'message' => "Complete reset successful! Wiped " . count($tablesToTruncate) . " match/notification/story tables and reset {$resetCount} players to original level buffer points."
    ]);
} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'message' => 'Reset error: ' . $e->getMessage()]);
}
?>
