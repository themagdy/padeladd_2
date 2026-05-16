<?php
/**
 * GET /api/stories/list
 * Returns active, unexpired stories from followed players.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

// Fetch stories from people the user follows
// We also include "seen" status to allow the UI to sort them
$sql = "
    SELECT 
        s.*, 
        s.score_id,
        v.name AS venue_name, 
        m.match_code, 
        m.match_datetime,
        (SELECT 1 FROM story_seen ss WHERE ss.story_id = s.id AND ss.user_id = :uid1) AS is_seen,
        GROUP_CONCAT(DISTINCT f.following_id) AS followed_player_ids,
        (CASE WHEN EXISTS(SELECT 1 FROM match_players mp2 WHERE mp2.match_id = s.match_id AND mp2.user_id = :uidSelf) THEN 1 ELSE 0 END) as is_mine
    FROM stories s
    LEFT JOIN venues v ON s.venue_id = v.id
    JOIN matches m ON s.match_id = m.id
    JOIN match_players mp ON s.match_id = mp.match_id
    LEFT JOIN follows f ON mp.user_id = f.following_id AND f.follower_id = :uidFollower
    WHERE (f.id IS NOT NULL OR mp.user_id = :uidSelf2)
      AND s.is_active = 1
      AND s.expires_at > NOW()
    GROUP BY s.id
    ORDER BY is_mine DESC, is_seen ASC, s.created_at DESC
";

$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':uid1' => $uid, 
    ':uidFollower' => $uid, 
    ':uidSelf' => $uid, 
    ':uidSelf2' => $uid
]);
$stories = $stmt->fetchAll(PDO::FETCH_ASSOC);

$result = [];
foreach ($stories as $s) {
    $mid = (int)$s['match_id'];
    
    // Fetch players for this match
    $pStmt = $pdo->prepare("
        SELECT u.id, u.first_name, u.last_name, up.nickname, up.profile_image, up.profile_image_thumb, up.player_code, up.level, mp.team_no
        FROM match_players mp
        JOIN users u ON mp.user_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE mp.match_id = ? AND mp.status = 'confirmed'
    ");
    $pStmt->execute([$mid]);
    $players = $pStmt->fetchAll(PDO::FETCH_ASSOC);

    $s['players'] = $players;
    $s['score_data'] = $s['score_data_json'] ? json_decode($s['score_data_json'], true) : null;
    unset($s['score_data_json']);
    
    $result[] = $s;
}

jsonResponse(true, 'Stories loaded.', ['stories' => $result]);
