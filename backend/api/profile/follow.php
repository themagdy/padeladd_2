<?php
/**
 * POST /api/profile/follow
 * Toggles follow/unfollow for a target user.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$target_id = (int)($data['target_user_id'] ?? 0);
if ($target_id <= 0) {
    jsonResponse(false, 'target_user_id is required.', null, 422);
}

if ((int)$target_id === (int)$uid) {
    jsonResponse(false, 'You cannot follow yourself.', null, 422);
}

if ($target_id === ADMIN_SYSTEM_USER_ID) {
    jsonResponse(false, 'You cannot follow this user.', null, 422);
}

// Check if already following
$stmt = $pdo->prepare("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?");
$stmt->execute([$uid, $target_id]);
$followId = $stmt->fetchColumn();

if ($followId) {
    // Unfollow
    $stmt = $pdo->prepare("DELETE FROM follows WHERE id = ?");
    $stmt->execute([$followId]);
    jsonResponse(true, 'Unfollowed successfully.', ['is_following' => false]);
} else {
    // Follow
    $stmt = $pdo->prepare("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)");
    $stmt->execute([$uid, $target_id]);
    jsonResponse(true, 'Followed successfully.', ['is_following' => true]);
}
