<?php
$pdo = getDB();
$token = getBearerToken();
$isAdmin = false;

if ($token) {
    $stmt = $pdo->prepare("SELECT id FROM admin_sessions WHERE token = ? AND (created_at IS NULL OR created_at >= NOW() - INTERVAL 15 DAY)");
    $stmt->execute([$token]);
    if ($stmt->fetch()) {
        $isAdmin = true;
    }
}

if ($isAdmin) {
    $targetUserId = isset($data['user_id']) ? (int)$data['user_id'] : 0;
} else {
    $user = getAuthenticatedUser($pdo);
    $targetUserId = $user['id']; // players can only query their own history
}

// Fetch points history log, joining with matches if match_id is not null to show venue/date details
$stmt = $pdo->prepare("
    SELECT 
        l.id,
        l.score_id,
        l.match_id,
        l.points_before,
        l.points_after,
        l.change_amount,
        l.buffer_points,
        l.reason,
        l.created_at,
        m.match_code,
        m.match_type,
        v.name AS venue_name,
        m.match_datetime,
        s.t1_set1, s.t2_set1, s.t1_set2, s.t2_set2, s.t1_set3, s.t2_set3,
        s.t1_p1_user_id, s.t1_p2_user_id, s.t2_p1_user_id, s.t2_p2_user_id
    FROM player_points_log l
    LEFT JOIN matches m ON l.match_id = m.id
    LEFT JOIN venues v ON m.venue_id = v.id
    LEFT JOIN scores s ON l.score_id = s.id
    WHERE l.user_id = ?
    ORDER BY l.created_at DESC, l.id DESC
");
$stmt->execute([$targetUserId]);
$history = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Map history output for clean response formatting
$formatted = [];
foreach ($history as $h) {
    $formatted[] = [
        'id'            => (int)$h['id'],
        'score_id'      => $h['score_id'] ? (int)$h['score_id'] : null,
        'points_before' => (int)$h['points_before'],
        'points_after'  => (int)$h['points_after'],
        'change_amount' => (int)$h['change_amount'],
        'buffer_points' => (int)$h['buffer_points'],
        'reason'        => $h['reason'],
        'created_at'    => $h['created_at'],
        'match'         => $h['match_id'] ? [
            'id'       => (int)$h['match_id'],
            'code'     => $h['match_code'],
            'type'     => $h['match_type'],
            'venue'    => $h['venue_name'],
            'datetime' => $h['match_datetime'],
            'score'    => $h['score_id'] ? [
                't1_set1' => (int)$h['t1_set1'],
                't2_set1' => (int)$h['t2_set1'],
                't1_set2' => (int)$h['t1_set2'],
                't2_set2' => (int)$h['t2_set2'],
                't1_set3' => (int)$h['t1_set3'],
                't2_set3' => (int)$h['t2_set3'],
                't1_p1'   => (int)$h['t1_p1_user_id'],
                't1_p2'   => (int)$h['t1_p2_user_id'],
                't2_p1'   => (int)$h['t2_p1_user_id'],
                't2_p2'   => (int)$h['t2_p2_user_id'],
            ] : null
        ] : null,
    ];
}

jsonResponse(true, 'Points history loaded.', [
    'history' => $formatted
]);
?>
