<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

// Get current image and thumbnail
$stmt = $pdo->prepare("SELECT profile_image, profile_image_thumb FROM user_profiles WHERE user_id = ?");
$stmt->execute([$user['id']]);
$oldData = $stmt->fetch(PDO::FETCH_ASSOC);

if ($oldData) {
    renameProfileImages($oldData['profile_image'], $oldData['profile_image_thumb']);
    
    $update = $pdo->prepare("UPDATE user_profiles SET profile_image = NULL, profile_image_thumb = NULL WHERE user_id = ?");
    $update->execute([$user['id']]);
}

jsonResponse(true, 'Image removed successfully.');
?>
