<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

// Get current image
$stmt = $pdo->prepare("SELECT profile_image FROM user_profiles WHERE user_id = ?");
$stmt->execute([$user['id']]);
$image = $stmt->fetchColumn();

if ($image) {
    $path = __DIR__ . '/../../../' . $image;
    if (file_exists($path) && is_file($path)) {
        unlink($path);
    }
    
    $update = $pdo->prepare("UPDATE user_profiles SET profile_image = NULL WHERE user_id = ?");
    $update->execute([$user['id']]);
}

jsonResponse(true, 'Image removed successfully.');
?>
