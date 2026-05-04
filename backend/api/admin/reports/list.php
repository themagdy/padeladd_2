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

jsonResponse(true, 'Reports fetched.', [
    'profile_reports' => $profileReports,
    'match_reports' => $matchReports
]);
