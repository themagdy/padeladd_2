<?php
/**
 * POST /api/profile/check_code
 * Validates a player code and returns the player's full name.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);

$code = strtoupper(trim($data['code'] ?? ''));

if ($code === '') {
    jsonResponse(false, 'Player code is required.', null, 400);
}

// Ensure the user is not querying their own code to play with themselves
$stmt = $pdo->prepare("
    SELECT u.first_name, up.nickname, up.user_id 
    FROM users u 
    JOIN user_profiles up ON u.id = up.user_id 
    WHERE up.player_code = ? AND u.status = 'active'
");
$stmt->execute([$code]);
$player = $stmt->fetch();

if (!$player) {
    jsonResponse(false, 'Player not found or invalid', null, 404);
}

if ($player['user_id'] === $user['id']) {
    jsonResponse(false, 'You cannot select yourself as a partner.', null, 422);
}

// Return formatted name
$displayName = !empty($player['nickname']) ? $player['nickname'] : $player['first_name'];

jsonResponse(true, 'Player found', [
    'name' => trim($displayName),
    'user_id' => (int)$player['user_id']
]);
