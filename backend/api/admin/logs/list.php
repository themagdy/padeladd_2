<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

// Filters
$type = $_GET['type'] ?? 'all';
$search = $_GET['search'] ?? '';
$limit = 100;

// Unified Query to gather everything
// type, user_id, user_name, user_code, match_id, match_code, details, created_at
$queries = [];

// 1. New Matches
$queries[] = "SELECT 
    'match_created' as event_type, 
    main.creator_id as user_id, 
    (SELECT nickname FROM user_profiles up WHERE up.user_id = main.creator_id LIMIT 1) as user_name,
    (SELECT player_code FROM user_profiles up WHERE up.user_id = main.creator_id LIMIT 1) as user_code,
    (SELECT profile_image_thumb FROM user_profiles up WHERE up.user_id = main.creator_id LIMIT 1) as user_avatar,
    main.id as match_id,
    main.match_code,
    CONCAT('Created a ', main.match_type, ' match') as details,
    main.created_at
FROM matches main";

// 2. Player Joined
$queries[] = "SELECT 
    'player_joined' as event_type,
    main.user_id,
    (SELECT nickname FROM user_profiles up WHERE up.user_id = main.user_id LIMIT 1) as user_name,
    (SELECT player_code FROM user_profiles up WHERE up.user_id = main.user_id LIMIT 1) as user_code,
    (SELECT profile_image_thumb FROM user_profiles up WHERE up.user_id = main.user_id LIMIT 1) as user_avatar,
    main.match_id,
    (SELECT match_code FROM matches m WHERE m.id = main.match_id LIMIT 1) as match_code,
    'Joined a match' as details,
    main.created_at
FROM match_players main";

// 3. Scores
$queries[] = "SELECT 
    'score_submitted' as event_type,
    main.submitted_by_user_id as user_id,
    (SELECT nickname FROM user_profiles up WHERE up.user_id = main.submitted_by_user_id LIMIT 1) as user_name,
    (SELECT player_code FROM user_profiles up WHERE up.user_id = main.submitted_by_user_id LIMIT 1) as user_code,
    (SELECT profile_image_thumb FROM user_profiles up WHERE up.user_id = main.submitted_by_user_id LIMIT 1) as user_avatar,
    main.match_id,
    (SELECT match_code FROM matches m WHERE m.id = main.match_id LIMIT 1) as match_code,
    'Submitted match scores' as details,
    main.created_at
FROM scores main";

// 4. Match Events
$queries[] = "SELECT 
    main.event_type,
    main.user_id,
    (SELECT nickname FROM user_profiles up WHERE up.user_id = main.user_id LIMIT 1) as user_name,
    (SELECT player_code FROM user_profiles up WHERE up.user_id = main.user_id LIMIT 1) as user_code,
    (SELECT profile_image_thumb FROM user_profiles up WHERE up.user_id = main.user_id LIMIT 1) as user_avatar,
    main.match_id,
    (SELECT match_code FROM matches m WHERE m.id = main.match_id LIMIT 1) as match_code,
    'Match status update / Withdrawal' as details,
    main.created_at
FROM match_events main";

// 5. New Users
$queries[] = "SELECT 
    'user_registered' as event_type,
    u.id as user_id,
    up.nickname as user_name,
    up.player_code as user_code,
    up.profile_image_thumb as user_avatar,
    NULL as match_id,
    NULL as match_code,
    'New player joined the platform' as details,
    u.created_at
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id";

// 6. Score Approvals
$queries[] = "SELECT 
    'score_approved' as event_type,
    main.approved_by_user_id as user_id,
    (SELECT nickname FROM user_profiles up WHERE up.user_id = main.approved_by_user_id LIMIT 1) as user_name,
    (SELECT player_code FROM user_profiles up WHERE up.user_id = main.approved_by_user_id LIMIT 1) as user_code,
    (SELECT profile_image_thumb FROM user_profiles up WHERE up.user_id = main.approved_by_user_id LIMIT 1) as user_avatar,
    main.match_id,
    (SELECT match_code FROM matches m WHERE m.id = main.match_id LIMIT 1) as match_code,
    'Match score approved' as details,
    main.updated_at as created_at
FROM scores main WHERE main.status = 'approved' AND main.approved_by_user_id IS NOT NULL";

// 7. Invites
$queries[] = "SELECT 
    'team_invite' as event_type,
    main.sender_id as user_id,
    (SELECT nickname FROM user_profiles up WHERE up.user_id = main.sender_id LIMIT 1) as user_name,
    (SELECT player_code FROM user_profiles up WHERE up.user_id = main.sender_id LIMIT 1) as user_code,
    (SELECT profile_image_thumb FROM user_profiles up WHERE up.user_id = main.sender_id LIMIT 1) as user_avatar,
    main.reference_id as match_id,
    (SELECT match_code FROM matches m WHERE m.id = main.reference_id LIMIT 1) as match_code,
    'Sent a team/match invitation' as details,
    main.created_at
FROM notifications main WHERE main.type = 'team_invite' AND main.sender_id IS NOT NULL";

// 8. Chat Messages
$queries[] = "SELECT 
    'chat_message' as event_type,
    main.user_id,
    (SELECT nickname FROM user_profiles up WHERE up.user_id = main.user_id LIMIT 1) as user_name,
    (SELECT player_code FROM user_profiles up WHERE up.user_id = main.user_id LIMIT 1) as user_code,
    (SELECT profile_image_thumb FROM user_profiles up WHERE up.user_id = main.user_id LIMIT 1) as user_avatar,
    main.match_id,
    (SELECT match_code FROM matches m WHERE m.id = main.match_id LIMIT 1) as match_code,
    main.message_text as details,
    main.created_at
FROM chat_messages main";

$sql = "SELECT * FROM (" . implode(" UNION ALL ", $queries) . ") as combined_logs";

$where = [];
$params = [];

if ($type !== 'all') {
    $where[] = "event_type = ?";
    $params[] = $type;
}

if ($search !== '') {
    $where[] = "(user_name LIKE ? OR user_code LIKE ? OR match_code LIKE ?)";
    $term = "%$search%";
    $params[] = $term;
    $params[] = $term;
    $params[] = $term;
}

if (!empty($where)) {
    $sql .= " WHERE " . implode(" AND ", $where);
}

$sql .= " ORDER BY created_at DESC LIMIT $limit";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

jsonResponse(true, 'Logs fetched.', ['logs' => $logs]);
