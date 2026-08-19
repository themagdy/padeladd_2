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
    'pending_reports' => (int)$pdo->query("SELECT (SELECT COUNT(*) FROM profile_reports WHERE is_archived = 0) + (SELECT COUNT(*) FROM match_reports WHERE is_archived = 0) + (SELECT COUNT(*) FROM disputes WHERE is_archived = 0)")->fetchColumn(),
    'pending_violations' => (int)$pdo->query("SELECT COUNT(*) FROM match_events WHERE event_type IN ('late_withdrawal', 'late_cancellation') AND (is_archived = 0 OR is_archived IS NULL)")->fetchColumn(),
    'venue_requests' => (int)$pdo->query("SELECT COUNT(*) FROM venues WHERE status = 'Requested'")->fetchColumn(),
];

// Determine date range
$startDateStr = isset($_GET['start_date']) ? trim($_GET['start_date']) : '';
$endDateStr = isset($_GET['end_date']) ? trim($_GET['end_date']) : '';
$days = isset($_GET['days']) ? (int)$_GET['days'] : 7;

if (!empty($startDateStr) && !empty($endDateStr)) {
    $start = new DateTime($startDateStr);
    $end = new DateTime($endDateStr);
} else {
    $days = max(1, min(365, $days));
    $end = new DateTime();
    $start = (clone $end)->modify('-' . ($days - 1) . ' days');
}

if ($start > $end) {
    $tmp = $start;
    $start = $end;
    $end = $tmp;
}

$startDate = $start->format('Y-m-d');
$endDate = $end->format('Y-m-d');

// Efficient aggregated queries across date range
$matchesStmt = $pdo->prepare("SELECT DATE(created_at) as d, COUNT(*) as c FROM matches WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at)");
$matchesStmt->execute([$startDate, $endDate]);
$matchesMap = $matchesStmt->fetchAll(PDO::FETCH_KEY_PAIR);

$playersStmt = $pdo->prepare("SELECT DATE(created_at) as d, COUNT(*) as c FROM users WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at)");
$playersStmt->execute([$startDate, $endDate]);
$playersMap = $playersStmt->fetchAll(PDO::FETCH_KEY_PAIR);

$scoresSubStmt = $pdo->prepare("SELECT DATE(created_at) as d, COUNT(*) as c FROM scores WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at)");
$scoresSubStmt->execute([$startDate, $endDate]);
$scoresSubMap = $scoresSubStmt->fetchAll(PDO::FETCH_KEY_PAIR);

$scoresAppStmt = $pdo->prepare("SELECT DATE(updated_at) as d, COUNT(*) as c FROM scores WHERE status = 'approved' AND DATE(updated_at) BETWEEN ? AND ? GROUP BY DATE(updated_at)");
$scoresAppStmt->execute([$startDate, $endDate]);
$scoresAppMap = $scoresAppStmt->fetchAll(PDO::FETCH_KEY_PAIR);

$joinsStmt = $pdo->prepare("SELECT DATE(created_at) as d, COUNT(*) as c FROM match_players WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at)");
$joinsStmt->execute([$startDate, $endDate]);
$joinsMap = $joinsStmt->fetchAll(PDO::FETCH_KEY_PAIR);

$eventsStmt = $pdo->prepare("SELECT DATE(created_at) as d, COUNT(*) as c FROM match_events WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at)");
$eventsStmt->execute([$startDate, $endDate]);
$eventsMap = $eventsStmt->fetchAll(PDO::FETCH_KEY_PAIR);

// Generate daily points
$activity = [];
$interval = new DateInterval('P1D');
$dateRange = new DatePeriod($start, $interval, (clone $end)->modify('+1 day'));

$totalDays = iterator_count($dateRange);
$dateRange = new DatePeriod($start, $interval, (clone $end)->modify('+1 day'));

foreach ($dateRange as $dt) {
    $curDate = $dt->format('Y-m-d');
    if ($totalDays <= 14) {
        $label = $dt->format('D j');
    } else {
        $label = $dt->format('j M');
    }

    $mCnt = isset($matchesMap[$curDate]) ? (int)$matchesMap[$curDate] : 0;
    $pCnt = isset($playersMap[$curDate]) ? (int)$playersMap[$curDate] : 0;
    $sSubCnt = isset($scoresSubMap[$curDate]) ? (int)$scoresSubMap[$curDate] : 0;
    $sAppCnt = isset($scoresAppMap[$curDate]) ? (int)$scoresAppMap[$curDate] : 0;
    $jCnt = isset($joinsMap[$curDate]) ? (int)$joinsMap[$curDate] : 0;
    $eCnt = isset($eventsMap[$curDate]) ? (int)$eventsMap[$curDate] : 0;

    $totalAct = $mCnt + $jCnt + $sSubCnt + $sAppCnt + $eCnt;

    $activity[] = [
        'full_date' => $curDate,
        'date' => $label,
        'matches' => $mCnt,
        'players' => $pCnt,
        'scores' => $sSubCnt,
        'logs' => $totalAct
    ];
}

$stats['activity_chart'] = $activity;
$stats['range'] = [
    'start_date' => $startDate,
    'end_date' => $endDate,
    'total_days' => $totalDays
];

jsonResponse(true, 'Stats fetched.', $stats);
