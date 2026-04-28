<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(false, 'No image uploaded or upload error.');
}

$file = $_FILES['image'];
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
if (!in_array($file['type'], $allowedTypes)) {
    jsonResponse(false, 'Invalid file type. Only JPG, PNG and WEBP are allowed.');
}

// Create uploads directory if not exists
$uploadDir = __DIR__ . '/../../../uploads/avatars/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

// Generate unique filename
$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = $user['id'] . '_' . time() . '.' . $ext;
$targetPath = $uploadDir . $filename;

// Process Image (Resize to 700px max)
$image = null;
$resizeSupported = true;

if ($file['type'] === 'image/jpeg') {
    if (function_exists('imagecreatefromjpeg')) $image = imagecreatefromjpeg($file['tmp_name']);
    else $resizeSupported = false;
} elseif ($file['type'] === 'image/png') {
    if (function_exists('imagecreatefrompng')) $image = imagecreatefrompng($file['tmp_name']);
    else $resizeSupported = false;
} elseif ($file['type'] === 'image/webp') {
    if (function_exists('imagecreatefromwebp')) $image = imagecreatefromwebp($file['tmp_name']);
    else $resizeSupported = false;
}

if (!$resizeSupported || !$image) {
    // If GD is missing or failed, just move the file without resizing
    if (isset($image)) imagedestroy($image);
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        jsonResponse(false, 'Failed to save uploaded file.');
    }
} else {
    // We have an image and GD is supported, continue with resizing
    $width = imagesx($image);
    $height = imagesy($image);
    $maxSize = 700;
    
    if ($width > $maxSize || $height > $maxSize) {
        if ($width > $height) {
            $newWidth = $maxSize;
            $newHeight = intval($height * ($maxSize / $width));
        } else {
            $newHeight = $maxSize;
            $newWidth = intval($width * ($maxSize / $height));
        }
        
        $newImage = imagecreatetruecolor($newWidth, $newHeight);
        
        // Preserve transparency for PNG/WEBP
        if ($file['type'] === 'image/png' || $file['type'] === 'image/webp') {
            imagealphablending($newImage, false);
            imagesavealpha($newImage, true);
        }
        
        imagecopyresampled($newImage, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        
        if ($file['type'] === 'image/jpeg') imagejpeg($newImage, $targetPath, 85);
        elseif ($file['type'] === 'image/png') imagepng($newImage, $targetPath);
        elseif ($file['type'] === 'image/webp') imagewebp($newImage, $targetPath, 85);
        
        imagedestroy($newImage);
    } else {
        move_uploaded_file($file['tmp_name'], $targetPath);
    }
    imagedestroy($image);
}

// Delete old image if exists
$oldImageStmt = $pdo->prepare("SELECT profile_image FROM user_profiles WHERE user_id = ?");
$oldImageStmt->execute([$user['id']]);
$oldImage = $oldImageStmt->fetchColumn();

if ($oldImage) {
    $oldPath = __DIR__ . '/../../../' . $oldImage;
    if (file_exists($oldPath) && is_file($oldPath)) {
        unlink($oldPath);
    }
}

// Update DB
$relativePath = 'uploads/avatars/' . $filename;

// Check if profile exists
$stmtProf = $pdo->prepare("SELECT id FROM user_profiles WHERE user_id = ?");
$stmtProf->execute([$user['id']]);
if ($stmtProf->rowCount() > 0) {
    $update = $pdo->prepare("UPDATE user_profiles SET profile_image = ? WHERE user_id = ?");
    $update->execute([$relativePath, $user['id']]);
} else {
    // Create skeleton profile so the image is saved
    $playerCode = generateUniquePlayerCode($pdo);
    $insert = $pdo->prepare("INSERT INTO user_profiles (user_id, profile_image, player_code) VALUES (?, ?, ?)");
    $insert->execute([$user['id'], $relativePath, $playerCode]);
}

jsonResponse(true, 'Image uploaded successfully.', ['profile_image' => $relativePath]);
?>
