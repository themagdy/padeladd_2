<?php
require_once __DIR__ . '/../backend/core/db.php';

$pdo = getDB();
$gender = 'female';
$limit = 100;

$stmt = $pdo->prepare("
    SELECT 
        u.id as user_id,
        u.first_name,
        up.nickname,
        (SELECT 1 FROM stories s 
         JOIN match_players mp_s ON s.match_id = mp_s.match_id 
         WHERE mp_s.user_id = u.id AND s.is_active = 1 AND s.expires_at > NOW() LIMIT 1) as has_active_story
    FROM player_stats ps
    JOIN users u ON ps.user_id = u.id
    JOIN user_profiles up ON ps.user_id = up.user_id
    WHERE up.gender = ? AND u.status = 'active'
    ORDER BY ps.rank_points DESC
    LIMIT ?
");

$stmt->execute([$gender, $limit]);
$ranking = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($ranking as $row) {
    if (in_array($row['user_id'], [23, 24, 36])) {
        echo "User {$row['user_id']} ({$row['nickname']}): has_active_story = " . ($row['has_active_story'] ? 'YES' : 'NO') . "\n";
    }
}
