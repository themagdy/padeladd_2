<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/security_helper.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

// Gather POST variables
$title = $_POST['title'] ?? '';
$body = $_POST['body'] ?? '';

// Sanitize inputs
$title = Security::sanitize($title);
// We do NOT strictly sanitize body since it contains HTML RTE content, but we want to ensure it is clean.
// In the system, inline HTML is stored for RTE. We'll store it as is.

if (empty($title)) {
    jsonResponse(false, 'Announcement title is required.');
}
if (empty($body)) {
    jsonResponse(false, 'Announcement body content is required.');
}
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(false, 'Featured cover image is required.');
}

$file = $_FILES['image'];

// Verify MIME type using finfo
$finfo = new finfo(FILEINFO_MIME_TYPE);
$realMimeType = $finfo->file($file['tmp_name']);

$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
if (!in_array($realMimeType, $allowedTypes)) {
    jsonResponse(false, 'Invalid image file type. Only JPG, PNG, and WEBP are allowed.');
}

// Create uploads directory if not exists
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
    // If GD processing fails, fallback to standard upload
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

// Save to DB
$relativePath = 'uploads/announcements/' . $filename;

try {
    $stmt = $pdo->prepare("INSERT INTO announcements (title, image_url, body) VALUES (?, ?, ?)");
    $stmt->execute([$title, $relativePath, $body]);
    $newId = $pdo->lastInsertId();

    jsonResponse(true, 'Announcement created successfully.', [
        'announcement' => [
            'id' => $newId,
            'title' => $title,
            'image_url' => $relativePath,
            'body' => $body,
            'created_at' => date('Y-m-d H:i:s')
        ]
    ]);
} catch (\Throwable $e) {
    jsonResponse(false, 'Database insert failed: ' . $e->getMessage());
}
?>
