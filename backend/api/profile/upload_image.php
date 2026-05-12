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

// Generate unique filenames
$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$baseName = $user['id'] . '_' . time();
$filename = $baseName . '.' . $ext;
$thumbFilename = $baseName . '_thumb.' . $ext;
$targetPath = $uploadDir . $filename;
$thumbPath = $uploadDir . $thumbFilename;

// Process Image
$image = null;
if ($file['type'] === 'image/jpeg') $image = @imagecreatefromjpeg($file['tmp_name']);
elseif ($file['type'] === 'image/png') $image = @imagecreatefrompng($file['tmp_name']);
elseif ($file['type'] === 'image/webp') $image = @imagecreatefromwebp($file['tmp_name']);

if (!$image) {
    // If GD failed, fallback to basic move
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        jsonResponse(false, 'Failed to save uploaded file.');
    }
    $thumbFilename = null; // No thumbnail generated
} else {
    $width = imagesx($image);
    $height = imagesy($image);

    // Function to resize and save
    function resizeAndSave($image, $path, $type, $targetSize, $origW, $origH) {
        if ($origW > $targetSize || $origH > $targetSize) {
            if ($origW > $origH) {
                $newW = $targetSize;
                $newH = intval($origH * ($targetSize / $origW));
            } else {
                $newH = $targetSize;
                $newW = intval($origW * ($targetSize / $origH));
            }
        } else {
            $newW = $origW;
            $newH = $origH;
        }

        $newImg = imagecreatetruecolor($newW, $newH);
        if ($type === 'image/png' || $type === 'image/webp') {
            imagealphablending($newImg, false);
            imagesavealpha($newImg, true);
        }
        imagecopyresampled($newImg, $image, 0, 0, 0, 0, $newW, $newH, $origW, $origH);
        
        if ($type === 'image/jpeg') imagejpeg($newImg, $path, 85);
        elseif ($type === 'image/png') imagepng($newImg, $path);
        elseif ($type === 'image/webp') imagewebp($newImg, $path, 85);
        imagedestroy($newImg);
    }

    // Save Main (700px)
    resizeAndSave($image, $targetPath, $file['type'], 700, $width, $height);
    // Save Thumb (150px)
    resizeAndSave($image, $thumbPath, $file['type'], 150, $width, $height);
    
    imagedestroy($image);
}

// Delete old images if they exist
$oldImageStmt = $pdo->prepare("SELECT profile_image, profile_image_thumb FROM user_profiles WHERE user_id = ?");
$oldImageStmt->execute([$user['id']]);
$oldData = $oldImageStmt->fetch(PDO::FETCH_ASSOC);

if ($oldData) {
    $pathsToDelete = [$oldData['profile_image'], $oldData['profile_image_thumb']];
    foreach ($pathsToDelete as $p) {
        if ($p) {
            $fullPath = __DIR__ . '/../../../' . $p;
            if (file_exists($fullPath) && is_file($fullPath)) unlink($fullPath);
        }
    }
}

// Update DB
$relativePath = 'uploads/avatars/' . $filename;
$relativeThumbPath = $thumbFilename ? 'uploads/avatars/' . $thumbFilename : null;

// Check if profile exists
$stmtProf = $pdo->prepare("SELECT id FROM user_profiles WHERE user_id = ?");
$stmtProf->execute([$user['id']]);
if ($stmtProf->rowCount() > 0) {
    $update = $pdo->prepare("UPDATE user_profiles SET profile_image = ?, profile_image_thumb = ? WHERE user_id = ?");
    $update->execute([$relativePath, $relativeThumbPath, $user['id']]);
} else {
    // Use a small retry loop in case of a rare race condition (duplicate player_code)
    $maxRetries = 3;
    $playerCode = null;
    while ($maxRetries > 0) {
        $playerCode = generateUniquePlayerCode($pdo);
        if (!$playerCode) {
            jsonResponse(false, 'Unable to generate unique player code.');
        }

        try {
            $insert = $pdo->prepare("INSERT INTO user_profiles (user_id, profile_image, profile_image_thumb, player_code) VALUES (?, ?, ?, ?)");
            $insert->execute([$user['id'], $relativePath, $relativeThumbPath, $playerCode]);
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
}

jsonResponse(true, 'Image uploaded successfully.', ['profile_image' => $relativePath, 'profile_image_thumb' => $relativeThumbPath]);
?>
