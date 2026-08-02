<?php
/**
 * POST /api/stories/mark_seen
 * Marks a story as seen by the current user.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$story_id = (int)($data['story_id'] ?? 0);
if ($story_id <= 0) {
    jsonResponse(false, 'story_id is required.', null, 422);
}

// Check if this story belongs to a match where the viewing user is a confirmed player (own story)
$stmtCheck = $pdo->prepare("
    SELECT 1 FROM stories s
    JOIN match_players mp ON s.match_id = mp.match_id
    WHERE s.id = ? AND mp.user_id = ? AND mp.status = 'confirmed'
");
$stmtCheck->execute([$story_id, $uid]);
if ($stmtCheck->fetchColumn()) {
    jsonResponse(true, 'Story marked as seen (own story ignored).');
}

// Insert or ignore (if already seen)
$stmt = $pdo->prepare("INSERT IGNORE INTO story_seen (story_id, user_id) VALUES (?, ?)");
$stmt->execute([$story_id, $uid]);

jsonResponse(true, 'Story marked as seen.');
