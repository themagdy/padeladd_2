<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/security_helper.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

$id = intval($_POST['id'] ?? 0);
$title = $_POST['title'] ?? '';
$body = $_POST['body'] ?? '';

$title = Security::sanitize($title);

if ($id <= 0) {
    jsonResponse(false, 'Invalid announcement ID.');
}
if (empty($title)) {
    jsonResponse(false, 'Announcement title is required.');
}
if (empty($body)) {
    jsonResponse(false, 'Announcement body content is required.');
}

// Check if announcement exists
$stmt = $pdo->prepare("SELECT * FROM announcements WHERE id = ?");
$stmt->execute([$id]);
$announcement = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$announcement) {
    jsonResponse(false, 'Announcement not found.');
}

$relativePath = $announcement['image_url'];

// Handle optional cover image replacement
if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
    $file = $_FILES['image'];

    // Verify MIME type using finfo
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $realMimeType = $finfo->file($file['tmp_name']);

    $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!in_array($realMimeType, $allowedTypes)) {
        jsonResponse(false, 'Invalid image file type. Only JPG, PNG, and WEBP are allowed.');
    }

    $uploadDir = __DIR__ . '/../../../../uploads/announcements/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $mimeToExt = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $ext = $mimeToExt[$realMimeType] ?? 'jpg';
    $filename = 'announcement_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $targetPath = $uploadDir . $filename;

    // Process and Resize Image to Max 1200px width
    $image = null;
    if ($realMimeType === 'image/jpeg') $image = @imagecreatefromjpeg($file['tmp_name']);
    elseif ($realMimeType === 'image/png') $image = @imagecreatefrompng($file['tmp_name']);
    elseif ($realMimeType === 'image/webp') $image = @imagecreatefromwebp($file['tmp_name']);

    if (!$image) {
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            jsonResponse(false, 'Failed to save cover image.');
        }
    } else {
        $origW = imagesx($image);
        $origH = imagesy($image);
        $targetSize = 1200;

        if ($origW > $targetSize) {
            $newW = $targetSize;
            $newH = intval($origH * ($targetSize / $origW));
        } else {
            $newW = $origW;
            $newH = $origH;
        }

        $newImg = imagecreatetruecolor($newW, $newH);
        if ($realMimeType === 'image/png' || $realMimeType === 'image/webp') {
            imagealphablending($newImg, false);
            imagesavealpha($newImg, true);
        }
        imagecopyresampled($newImg, $image, 0, 0, 0, 0, $newW, $newH, $origW, $origH);

        if ($realMimeType === 'image/jpeg') imagejpeg($newImg, $targetPath, 85);
        elseif ($realMimeType === 'image/png') imagepng($newImg, $targetPath);
        elseif ($realMimeType === 'image/webp') imagewebp($newImg, $targetPath, 85);

        imagedestroy($newImg);
        imagedestroy($image);
    }

    // Delete old image if exists
    $oldFilePath = __DIR__ . '/../../../../' . $announcement['image_url'];
    if (file_exists($oldFilePath) && is_file($oldFilePath)) {
        @unlink($oldFilePath);
    }

    $relativePath = 'uploads/announcements/' . $filename;
}

try {
    $stmtUpdate = $pdo->prepare("UPDATE announcements SET title = ?, image_url = ?, body = ? WHERE id = ?");
    $stmtUpdate->execute([$title, $relativePath, $body, $id]);

    jsonResponse(true, 'Announcement updated successfully.', [
        'announcement' => [
            'id' => $id,
            'title' => $title,
            'image_url' => $relativePath,
            'body' => $body,
            'created_at' => $announcement['created_at']
        ]
    ]);
} catch (\Throwable $e) {
    jsonResponse(false, 'Database update failed: ' . $e->getMessage());
}
?>
