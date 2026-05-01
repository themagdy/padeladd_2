<?php
/**
 * One-time migration script to generate thumbnails for all existing profile images.
 * Access this via your browser (e.g., padeladd.com/backend/api/profile/migrate_thumbnails.php)
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/helpers.php';

$pdo = getDB();

// Fetch all profiles that have an image but no thumbnail
$stmt = $pdo->query("SELECT id, user_id, profile_image FROM user_profiles WHERE profile_image IS NOT NULL AND profile_image != '' AND (profile_image_thumb IS NULL OR profile_image_thumb = '')");
$profiles = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found " . count($profiles) . " profiles to migrate.<br><br>";

$count = 0;
foreach ($profiles as $p) {
    $fullPath = __DIR__ . '/../../../' . $p['profile_image'];
    
    if (!file_exists($fullPath) || !is_file($fullPath)) {
        echo "Skipping User #{$p['user_id']}: File not found ($fullPath)<br>";
        continue;
    }

    $ext = pathinfo($fullPath, PATHINFO_EXTENSION);
    $thumbPath = str_replace('.' . $ext, '_thumb.' . $ext, $fullPath);
    $relativeThumbPath = str_replace('.' . $ext, '_thumb.' . $ext, $p['profile_image']);

    // Process Image
    $image = null;
    $type = mime_content_type($fullPath);
    
    if ($type === 'image/jpeg') $image = @imagecreatefromjpeg($fullPath);
    elseif ($type === 'image/png') $image = @imagecreatefrompng($fullPath);
    elseif ($type === 'image/webp') $image = @imagecreatefromwebp($fullPath);

    if (!$image) {
        echo "Skipping User #{$p['user_id']}: Could not create image from file (Unsupported format?)<br>";
        continue;
    }

    $width = imagesx($image);
    $height = imagesy($image);
    $targetSize = 150;

    if ($width > $targetSize || $height > $targetSize) {
        if ($width > $height) {
            $newW = $targetSize;
            $newH = intval($height * ($targetSize / $width));
        } else {
            $newH = $targetSize;
            $newW = intval($width * ($targetSize / $height));
        }
    } else {
        $newW = $width;
        $newH = $height;
    }

    $newImg = imagecreatetruecolor($newW, $newH);
    if ($type === 'image/png' || $type === 'image/webp') {
        imagealphablending($newImg, false);
        imagesavealpha($newImg, true);
    }
    imagecopyresampled($newImg, $image, 0, 0, 0, 0, $newW, $newH, $width, $height);
    
    $saved = false;
    if ($type === 'image/jpeg') $saved = imagejpeg($newImg, $thumbPath, 85);
    elseif ($type === 'image/png') $saved = imagepng($newImg, $thumbPath);
    elseif ($type === 'image/webp') $saved = imagewebp($newImg, $thumbPath, 85);
    
    imagedestroy($newImg);
    imagedestroy($image);

    if ($saved) {
        $update = $pdo->prepare("UPDATE user_profiles SET profile_image_thumb = ? WHERE id = ?");
        $update->execute([$relativeThumbPath, $p['id']]);
        echo "✅ Migrated User #{$p['user_id']}<br>";
        $count++;
    } else {
        echo "❌ Failed to save thumbnail for User #{$p['user_id']}<br>";
    }
}

echo "<br>Finished! Successfully migrated $count profiles.";
?>
