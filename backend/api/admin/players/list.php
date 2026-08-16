<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();
$search = trim($_GET['search'] ?? '');
$status = trim($_GET['status'] ?? 'all');
$limit  = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
$offset = isset($_GET['offset']) ? max(0, intval($_GET['offset'])) : 0;

$whereClause = " WHERE u.id != " . ADMIN_SYSTEM_USER_ID;
$params = [];

if (!empty($search)) {
    $whereClause .= " AND (u.first_name LIKE :s1 OR u.last_name LIKE :s2 OR up.nickname LIKE :s3 OR u.mobile LIKE :s4 OR u.email LIKE :s5 OR up.player_code LIKE :s6 OR CONCAT(u.first_name, ' ', u.last_name) LIKE :s7)";
    $term = "%$search%";
    for ($i = 1; $i <= 7; $i++) {
        $params[":s$i"] = $term;
    }
}

if (!empty($status) && $status !== 'all') {
    $whereClause .= " AND u.status = :status";
    $params[':status'] = $status;
}

// Count total matching players
$countSql = "SELECT COUNT(*) FROM users u JOIN user_profiles up ON u.id = up.user_id " . $whereClause;
$countStmt = $pdo->prepare($countSql);
foreach ($params as $key => $val) {
    $countStmt->bindValue($key, $val);
}
$countStmt->execute();
$totalCount = (int)$countStmt->fetchColumn();

// Fetch page results
$sort = $_GET['sort'] ?? 'name';
$order = $_GET['order'] ?? 'ASC';

$allowedSorts = [
    'name' => "u.first_name",
    'status' => "u.status",
    'gender' => "up.gender"
];

$sortCol = $allowedSorts[$sort] ?? "u.first_name";
$orderDir = (strtoupper($order) === 'DESC') ? 'DESC' : 'ASC';

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
           AND m.match_type = 'competition'
           AND m.match_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as points_this_week
    FROM users u
    JOIN user_profiles up ON u.id = up.user_id
    LEFT JOIN player_stats ps ON u.id = ps.user_id
    {$whereClause}
    ORDER BY {$sortCol} {$orderDir}
    LIMIT :limit OFFSET :offset
";

$stmt = $pdo->prepare($sql);
foreach ($params as $key => $val) {
    $stmt->bindValue($key, $val);
}
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$players = $stmt->fetchAll(PDO::FETCH_ASSOC);

$hasMore = ($offset + count($players)) < $totalCount;

jsonResponse(true, 'Players fetched successfully.', [
    'players'     => $players,
    'has_more'    => $hasMore,
    'total_count' => $totalCount,
    'offset'      => $offset,
    'limit'       => $limit
]);

