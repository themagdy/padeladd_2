<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

$first = trim($data['first_name'] ?? '');
$last  = trim($data['last_name'] ?? '');
$dob = trim($data['date_of_birth'] ?? '');
$gender = trim($data['gender'] ?? '');
$playingSide = trim($data['playing_side'] ?? '');
$nickname = trim($data['nickname'] ?? '');
$location = trim($data['location'] ?? '');
$bio = trim($data['bio'] ?? '');

// Basic validation
if (empty($first) || empty($last) || empty($dob) || empty($gender) || empty($playingSide) || empty($location)) {
    jsonResponse(false, 'First name, last name, date of birth, gender, playing side, and location are required.');
}

// Update primary user info
$upUser = $pdo->prepare("UPDATE users SET first_name = ?, last_name = ? WHERE id = ?");
$upUser->execute([$first, $last, $user['id']]);

if (empty($nickname)) {
    // Fall back to first name if not populated
    $nickname = $first;
}

// Check if a profile already exists
$stmtProf = $pdo->prepare("SELECT player_code, level FROM user_profiles WHERE user_id = ?");
$stmtProf->execute([$user['id']]);
$existingProfile = $stmtProf->fetch();
$hasProfile = $existingProfile !== false;

if ($hasProfile) {
    // Update
    $update = $pdo->prepare("UPDATE user_profiles SET date_of_birth=?, gender=?, playing_side=?, nickname=?, location=?, bio=? WHERE user_id=?");
    $update->execute([$dob, $gender, $playingSide, $nickname, $location, $bio, $user['id']]);
    
    $isMissingLevel = empty($existingProfile['level']);
    
    // Give them their base points so they appear on leaderboards
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, current_buffer, initial_buffer, buffer_matches_left, rank_points) VALUES (?, 100, 100, 20, 0)")->execute([$user['id']]);

    jsonResponse(true, 'Profile updated successfully.', [
        'player_code' => $existingProfile['player_code'],
        'is_new_profile' => $isMissingLevel
    ]);
} else {
    // Insert new profile
    $playerCode = generateUniquePlayerCode($pdo);
    if (!$playerCode) {
        jsonResponse(false, 'Unable to generate unique player code.');
    }

    $insert = $pdo->prepare("INSERT INTO user_profiles (user_id, date_of_birth, gender, playing_side, nickname, location, bio, player_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $insert->execute([$user['id'], $dob, $gender, $playingSide, $nickname, $location, $bio, $playerCode]);
    
    // Give them their base points so they appear on leaderboards
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, current_buffer, initial_buffer, buffer_matches_left, rank_points) VALUES (?, 100, 100, 20, 0)")->execute([$user['id']]);

    jsonResponse(true, 'Profile created successfully.', ['player_code' => $playerCode, 'is_new_profile' => true]);
}
?>
