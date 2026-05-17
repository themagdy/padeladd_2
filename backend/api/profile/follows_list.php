<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

$type = $data['type'] ?? 'followers'; // 'followers' or 'following'
$targetId = $data['target_id'] ?? $user['id'];

if ($type === 'followers') {
    // Users who follow targetId
    $stmt = $pdo->prepare("
        SELECT u.id, u.first_name, u.last_name, up.player_code, up.nickname, up.profile_image_thumb,
               (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE f.following_id = ? AND u.status = 'active'
        ORDER BY u.first_name ASC
    ");
    $stmt->execute([$user['id'], $targetId]);
} else {
    // Users who targetId follows
    $stmt = $pdo->prepare("
        SELECT u.id, u.first_name, u.last_name, up.player_code, up.nickname, up.profile_image_thumb,
               (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
        FROM follows f
        JOIN users u ON f.following_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE f.follower_id = ? AND u.status = 'active'
        ORDER BY u.first_name ASC
    ");
    $stmt->execute([$user['id'], $targetId]);
}

$list = $stmt->fetchAll();

// Format response
$res = [];
foreach ($list as $row) {
    $name = $row['nickname'] ?: ($row['first_name'] . ' ' . $row['last_name']);
    $res[] = [
        'id' => $row['id'],
        'name' => $name,
        'first_name' => $row['first_name'],
        'last_name' => $row['last_name'],
        'player_code' => $row['player_code'],
        'image' => $row['profile_image_thumb'],
        'is_following' => (bool)$row['is_following']
    ];
}

jsonResponse(true, 'List fetched', $res);
?>
