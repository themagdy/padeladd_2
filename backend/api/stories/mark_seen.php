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

// Insert or ignore (if already seen)
$stmt = $pdo->prepare("INSERT IGNORE INTO story_seen (story_id, user_id) VALUES (?, ?)");
$stmt->execute([$story_id, $uid]);

jsonResponse(true, 'Story marked as seen.');
