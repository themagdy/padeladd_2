<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

// Fetch Late Withdrawals and Cancellations
$sql = "
    SELECT me.*, 
           up.nickname as player_name, up.player_code,
           m.match_code, m.match_datetime
    FROM match_events me
    LEFT JOIN user_profiles up ON me.user_id = up.user_id
    LEFT JOIN matches m ON me.match_id = m.id
    WHERE me.event_type IN ('late_withdrawal', 'late_cancellation')
    ORDER BY me.created_at DESC
";

try {
    $violations = $pdo->query($sql)->fetchAll();
    
    // Process event_data to extract hours_until_match
    foreach ($violations as &$v) {
        $data = json_decode($v['event_data'], true);
        $v['hours_until'] = $data['hours_until_match'] ?? '---';
        $v['reason'] = $data['reason'] ?? 'No reason provided';
    }

    jsonResponse(true, 'Policy violations fetched.', ['violations' => $violations]);
} catch (Exception $e) {
    jsonResponse(false, 'Failed to fetch violations: ' . $e->getMessage(), null, 500);
}
