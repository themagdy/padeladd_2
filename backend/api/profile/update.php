<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

$first = trim($data['first_name'] ?? '');
$last  = trim($data['last_name'] ?? '');
$dob = trim($data['date_of_birth'] ?? '');
$gender = trim($data['gender'] ?? '');
$playingSide = trim($data['playing_side'] ?? '');
$nickname = trim($data['nickname'] ?? '');
$locationId = isset($data['location_id']) ? (int)$data['location_id'] : 0;
$bio = trim($data['bio'] ?? '');

// Basic validation
if (empty($first) || empty($last) || empty($dob) || empty($gender) || empty($playingSide) || !$locationId) {
    jsonResponse(false, 'First name, last name, date of birth, gender, playing side, and location are required.');
}

// Age validation
$birthDate = new DateTime($dob);
$today = new DateTime('today');
$age = $birthDate->diff($today)->y;
if ($age < 16) {
    jsonResponse(false, 'You must be at least 16 years old to use Padeladd.');
}
if ($age > 65) {
    jsonResponse(false, 'The maximum allowed age to register is 65.');
}

// Validate location ID
$locCheck = $pdo->prepare("SELECT id FROM locations WHERE id = ?");
$locCheck->execute([$locationId]);
if (!$locCheck->fetch()) {
    jsonResponse(false, 'Invalid location selected.');
}

// Update primary user info
$upUser = $pdo->prepare("UPDATE users SET first_name = ?, last_name = ? WHERE id = ?");
$upUser->execute([$first, $last, $user['id']]);

if (empty($nickname)) {
    // Fall back to first name if not populated
    $nickname = $first;
}

// Check if a profile already exists
$stmtProf = $pdo->prepare("SELECT player_code, level, gender FROM user_profiles WHERE user_id = ?");
$stmtProf->execute([$user['id']]);
$existingProfile = $stmtProf->fetch();
$hasProfile = $existingProfile !== false;

if ($hasProfile) {
    // If gender is already set in the database, lock it (ignore the incoming $gender value)
    if (!empty($existingProfile['gender'])) {
        $gender = $existingProfile['gender'];
    }

    // Update
    $update = $pdo->prepare("UPDATE user_profiles SET date_of_birth=?, gender=?, playing_side=?, nickname=?, location_id=?, bio=? WHERE user_id=?");
    $update->execute([$dob, $gender, $playingSide, $nickname, $locationId, $bio, $user['id']]);
    
    $isMissingLevel = empty($existingProfile['level']);
    
    // Give them their base points so they appear on leaderboards
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, current_buffer, initial_buffer, buffer_matches_left, rank_points) VALUES (?, 100, 100, 20, 0)")->execute([$user['id']]);

    jsonResponse(true, 'Profile updated successfully.', [
        'player_code' => $existingProfile['player_code'],
        'is_new_profile' => $isMissingLevel
    ]);
} else {
    // Insert new profile
    // Use a small retry loop in case of a rare race condition (duplicate player_code)
    $maxRetries = 3;
    $playerCode = null;
    while ($maxRetries > 0) {
        $playerCode = generateUniquePlayerCode($pdo);
        if (!$playerCode) {
            jsonResponse(false, 'Unable to generate unique player code.');
        }

        try {
            $insert = $pdo->prepare("INSERT INTO user_profiles (user_id, date_of_birth, gender, playing_side, nickname, location_id, bio, player_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $insert->execute([$user['id'], $dob, $gender, $playingSide, $nickname, $locationId, $bio, $playerCode]);
            break; // Success
        } catch (PDOException $e) {
            if ($e->getCode() == '23000') { // Duplicate entry
                $maxRetries--;
                continue;
            }
            throw $e;
        }
    }
    
    if ($maxRetries <= 0) {
        jsonResponse(false, 'Failed to generate a unique code after multiple attempts.');
    }
    
    // Give them their base points so they appear on leaderboards
    $pdo->prepare("INSERT IGNORE INTO player_stats (user_id, current_buffer, initial_buffer, buffer_matches_left, rank_points) VALUES (?, 100, 100, 20, 0)")->execute([$user['id']]);

    jsonResponse(true, 'Profile created successfully.', ['player_code' => $playerCode, 'is_new_profile' => true]);
}
?>
