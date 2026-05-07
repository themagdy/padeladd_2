<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

// Fetch Profile Reports
$sqlProfile = "
    SELECT r.*, reporter.nickname as reporter_name, reporter.player_code as reporter_code, 
           target.nickname as target_name, target.player_code as target_code
    FROM profile_reports r
    LEFT JOIN user_profiles reporter ON r.reported_by_user_id = reporter.user_id
    LEFT JOIN user_profiles target ON r.target_user_id = target.user_id
    ORDER BY r.created_at DESC
";
$profileReports = $pdo->query($sqlProfile)->fetchAll();

// Fetch Match Reports
$sqlMatch = "
    SELECT r.*, reporter.nickname as reporter_name, reporter.player_code as reporter_code, m.match_code
    FROM match_reports r
    LEFT JOIN user_profiles reporter ON r.reported_by_user_id = reporter.user_id
    LEFT JOIN matches m ON r.match_id = m.id
    ORDER BY r.created_at DESC
";
$matchReports = $pdo->query($sqlMatch)->fetchAll();

// Fetch Score Disputes
$sqlDisputes = "
    SELECT d.*, m.match_code, 
           disputer.nickname as reporter_name, disputer.player_code as reporter_code,
           submitter.nickname as target_name, submitter.player_code as target_code,
           s.t1_set1, s.t1_set2, s.t1_set3, s.t2_set1, s.t2_set2, s.t2_set3
    FROM disputes d
    LEFT JOIN matches m ON d.match_id = m.id
    LEFT JOIN scores s ON d.score_id = s.id
    LEFT JOIN user_profiles disputer ON d.disputed_by_user_id = disputer.user_id
    LEFT JOIN user_profiles submitter ON s.submitted_by_user_id = submitter.user_id
    ORDER BY d.created_at DESC
";
$scoreDisputes = $pdo->query($sqlDisputes)->fetchAll();

// Fetch System Reports
$sqlSystem = "
    SELECT r.*, reporter.nickname as reporter_name, reporter.player_code as reporter_code
    FROM system_reports r
    LEFT JOIN user_profiles reporter ON r.user_id = reporter.user_id
    ORDER BY r.created_at DESC
";
$systemReports = $pdo->query($sqlSystem)->fetchAll();

jsonResponse(true, 'Reports fetched.', [
    'profile_reports' => $profileReports,
    'match_reports' => $matchReports,
    'score_disputes' => $scoreDisputes,
    'system_reports' => $systemReports
]);
