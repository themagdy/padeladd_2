<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();
$search = $_GET['search'] ?? '';

$sql = "
    SELECT 
        u.id, u.first_name, u.last_name, u.email, u.mobile as phone, u.status as account_status,
        CONCAT(u.first_name, ' ', u.last_name) as full_name, 
        up.nickname, up.player_code, up.gender, up.profile_image_thumb,
        ps.rank_points, ps.current_buffer, ps.buffer_matches_left,
        (SELECT COALESCE(SUM(mp.point_change), 0) 
         FROM match_players mp 
         JOIN matches m ON mp.match_id = m.id 
         WHERE mp.user_id = u.id 
           AND m.status = 'completed'
           AND m.match_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as points_this_week
    FROM users u
    JOIN user_profiles up ON u.id = up.user_id
    LEFT JOIN player_stats ps ON u.id = ps.user_id
    WHERE 1=1
";

$params = [];
if (!empty($search)) {
    $sql .= " AND (u.first_name LIKE ? OR u.last_name LIKE ? OR up.nickname LIKE ? OR u.mobile LIKE ? OR u.email LIKE ? OR up.player_code LIKE ?)";
    $term = "%$search%";
    $params = [$term, $term, $term, $term, $term, $term];
}

$sort = $_GET['sort'] ?? 'name';
$order = $_GET['order'] ?? 'ASC';

$allowedSorts = [
    'name' => "u.first_name",
    'status' => "u.status",
    'gender' => "up.gender"
];

$sortCol = $allowedSorts[$sort] ?? "u.first_name";
$orderDir = (strtoupper($order) === 'DESC') ? 'DESC' : 'ASC';

$sql .= " ORDER BY $sortCol $orderDir";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$players = $stmt->fetchAll();

jsonResponse(true, 'Players fetched successfully.', ['players' => $players]);
