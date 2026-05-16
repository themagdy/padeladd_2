<?php
/**
 * GET /api/stories/user
 * Returns active stories for a specific player (Direct Access).
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$myId = $user['id'];

$targetId = (int)($data['user_id'] ?? ($_GET['user_id'] ?? 0));
if ($targetId <= 0) {
    jsonResponse(false, 'user_id is required.', null, 422);
}

// Find active stories where this player is a participant
$sql = "
    SELECT DISTINCT 
        s.*, 
        v.name AS venue_name, 
        m.match_code, 
        m.match_datetime,
        (SELECT 1 FROM story_seen ss WHERE ss.story_id = s.id AND ss.user_id = :myId) AS is_seen
    FROM stories s
    LEFT JOIN venues v ON s.venue_id = v.id
    JOIN matches m ON s.match_id = m.id
    JOIN match_players mp ON s.match_id = mp.match_id
    WHERE mp.user_id = :targetId
      AND s.is_active = 1
      AND s.expires_at > NOW()
    ORDER BY s.created_at DESC
";

$stmt = $pdo->prepare($sql);
$stmt->execute([':targetId' => $targetId, ':myId' => $myId]);
$stories = $stmt->fetchAll(PDO::FETCH_ASSOC);

$result = [];
foreach ($stories as $s) {
    $mid = (int)$s['match_id'];
    
    // Fetch all players for this story's match
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

// Fetch the target player info for the header
$playerStmt = $pdo->prepare("
    SELECT u.id, u.first_name, u.last_name, up.nickname, up.profile_image, up.profile_image_thumb, up.player_code, up.level
    FROM users u
    LEFT JOIN user_profiles up ON u.id = up.user_id
    WHERE u.id = ?
");
$playerStmt->execute([$targetId]);
$targetPlayer = $playerStmt->fetch(PDO::FETCH_ASSOC);

jsonResponse(true, 'User stories loaded.', [
    'stories' => $result,
    'player' => $targetPlayer
]);
