<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

$stmt = $pdo->prepare("
    SELECT m.*,
        ua1.first_name as a1_first, ua1.last_name as a1_last,
        ua2.first_name as a2_first, ua2.last_name as a2_last,
        ub1.first_name as b1_first, ub1.last_name as b1_last,
        ub2.first_name as b2_first, ub2.last_name as b2_last
    FROM matches m
    LEFT JOIN users ua1 ON m.team_a1_id = ua1.id
    LEFT JOIN users ua2 ON m.team_a2_id = ua2.id
    LEFT JOIN users ub1 ON m.team_b1_id = ub1.id
    LEFT JOIN users ub2 ON m.team_b2_id = ub2.id
    WHERE m.team_a1_id = ? OR m.team_a2_id = ? OR m.team_b1_id = ? OR m.team_b2_id = ?
    ORDER BY m.scheduled_at DESC
    LIMIT 20
");
$stmt->execute([$uid, $uid, $uid, $uid]);
$matches = $stmt->fetchAll();

$result = [];
foreach ($matches as $m) {
    $result[] = [
        'id'        => $m['id'],
        'venue'     => $m['venue'],
        'scheduled_at' => $m['scheduled_at'],
        'status'    => $m['status'],
        'score_a'   => $m['score_a'],
        'score_b'   => $m['score_b'],
        'winner_team' => $m['winner_team'],
        'team_a' => [
            ['name' => trim(($m['a1_first'] ?? '') . ' ' . ($m['a1_last'] ?? '')), 'id' => $m['team_a1_id']],
            ['name' => trim(($m['a2_first'] ?? '') . ' ' . ($m['a2_last'] ?? '')), 'id' => $m['team_a2_id']],
        ],
        'team_b' => [
            ['name' => trim(($m['b1_first'] ?? '') . ' ' . ($m['b1_last'] ?? '')), 'id' => $m['team_b1_id']],
            ['name' => trim(($m['b2_first'] ?? '') . ' ' . ($m['b2_last'] ?? '')), 'id' => $m['team_b2_id']],
        ],
        'user_team' => (in_array($uid, [$m['team_a1_id'], $m['team_a2_id']])) ? 'a' : 'b',
    ];
}

jsonResponse(true, 'Matches loaded.', ['matches' => $result]);
?>
