<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

$stats = [
    'total_players' => (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn(),
    'matches_today' => (int)$pdo->query("SELECT COUNT(*) FROM matches WHERE DATE(match_datetime) = CURDATE()")->fetchColumn(),
    'played_matches' => (int)$pdo->query("SELECT COUNT(*) FROM matches WHERE status = 'completed'")->fetchColumn(),
    'scores_submitted' => (int)$pdo->query("SELECT COUNT(*) FROM scores")->fetchColumn(),
    'pending_reports' => (int)$pdo->query("SELECT (SELECT COUNT(*) FROM profile_reports WHERE is_archived = 0) + (SELECT COUNT(*) FROM match_reports WHERE is_archived = 0)")->fetchColumn(),
    'pending_violations' => (int)$pdo->query("SELECT COUNT(*) FROM match_events WHERE event_type IN ('late_withdrawal', 'late_cancellation') AND (is_archived = 0 OR is_archived IS NULL)")->fetchColumn(),
    'venue_requests' => (int)$pdo->query("SELECT COUNT(*) FROM venue_requests WHERE status = 'pending'")->fetchColumn(),
];

// Activity Graph Data (Last 7 Days)
$activity = [];
for ($i = 6; $i >= 0; $i--) {
    $date = date('Y-m-d', strtotime("-$i days"));
    $label = date('D', strtotime($date));
    
    $matches = $pdo->prepare("SELECT COUNT(*) FROM matches WHERE DATE(created_at) = ?");
    $matches->execute([$date]);
    $matches_count = (int)$matches->fetchColumn();
    
    $players = $pdo->prepare("SELECT COUNT(*) FROM users WHERE DATE(created_at) = ?");
    $players->execute([$date]);

    $scores_sub = $pdo->prepare("SELECT COUNT(*) FROM scores WHERE DATE(created_at) = ?");
    $scores_sub->execute([$date]);
    $scores_count = (int)$scores_sub->fetchColumn();

    $scores_app = $pdo->prepare("SELECT COUNT(*) FROM scores WHERE status = 'approved' AND DATE(updated_at) = ?");
    $scores_app->execute([$date]);
    $scores_app_count = (int)$scores_app->fetchColumn();

    $joins = $pdo->prepare("SELECT COUNT(*) FROM match_players WHERE DATE(created_at) = ?");
    $joins->execute([$date]);
    $joins_count = (int)$joins_count = $joins->fetchColumn();

    $events = $pdo->prepare("SELECT COUNT(*) FROM match_events WHERE DATE(created_at) = ?");
    $events->execute([$date]);
    $events_count = (int)$events->fetchColumn();
    
    // Activity is the SUM of everything
    $total_activity = $matches_count + $joins_count + $scores_count + $scores_app_count + $events_count;

    $activity[] = [
        'date' => $label,
        'matches' => $matches_count,
        'players' => (int)$players->fetchColumn(),
        'scores' => $scores_count,
        'logs' => $total_activity
    ];
}
$stats['activity_chart'] = $activity;

jsonResponse(true, 'Stats fetched.', $stats);
