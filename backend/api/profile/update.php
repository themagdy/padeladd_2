<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

$dob = trim($data['date_of_birth'] ?? '');
$gender = trim($data['gender'] ?? '');
$playingHand = trim($data['playing_hand'] ?? '');
$nickname = trim($data['nickname'] ?? '');
$location = trim($data['location'] ?? '');
$bio = trim($data['bio'] ?? '');

// Basic validation
if (empty($dob) || empty($gender) || empty($playingHand)) {
    jsonResponse(false, 'Date of birth, gender, and playing hand are required.');
}

if (empty($nickname)) {
    // Fall back to first name if not populated
    $nickname = $user['first_name'];
}

// Check if a profile already exists
$stmtProf = $pdo->prepare("SELECT id FROM user_profiles WHERE user_id = ?");
$stmtProf->execute([$user['id']]);
$hasProfile = $stmtProf->rowCount() > 0;

if ($hasProfile) {
    // Update
    $update = $pdo->prepare("UPDATE user_profiles SET date_of_birth=?, gender=?, playing_hand=?, nickname=?, location=?, bio=? WHERE user_id=?");
    $update->execute([$dob, $gender, $playingHand, $nickname, $location, $bio, $user['id']]);
    jsonResponse(true, 'Profile updated successfully.');
} else {
    // Insert new profile
    // Generate unique player code
    $playerCode = 'PADEL-' . strtoupper(substr($user['first_name'], 0, 1) . substr($user['last_name'], 0, 1)) . '-' . mt_rand(1000, 9999);
    
    // Ensure uniqueness
    $checkCode = $pdo->prepare("SELECT id FROM user_profiles WHERE player_code = ?");
    do {
        $checkCode->execute([$playerCode]);
        if ($checkCode->rowCount() == 0) break;
        $playerCode = 'PADEL-' . mt_rand(10000, 99999);
    } while(true);

    $insert = $pdo->prepare("INSERT INTO user_profiles (user_id, date_of_birth, gender, playing_hand, nickname, location, bio, player_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $insert->execute([$user['id'], $dob, $gender, $playingHand, $nickname, $location, $bio, $playerCode]);
    jsonResponse(true, 'Profile created successfully.', ['player_code' => $playerCode]);
}
?>
