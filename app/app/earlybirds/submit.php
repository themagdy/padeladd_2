<?php
header('Content-Type: application/json; charset=utf-8');

// Enable CORS for same-origin and safe handling
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

// Read raw JSON input or POST form data
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data) {
    $data = $_POST;
}

$fullName = trim($data['full_name'] ?? '');
$phone = trim($data['phone'] ?? '');
$level = trim($data['level'] ?? '');

// Validation
if (empty($fullName)) {
    echo json_encode(['success' => false, 'message' => 'Full Name is required.']);
    exit;
}

if (empty($phone)) {
    echo json_encode(['success' => false, 'message' => 'Phone number is required.']);
    exit;
}

if (empty($level)) {
    echo json_encode(['success' => false, 'message' => 'Please select your level.']);
    exit;
}

// Target directory for saving JSON files
$targetDir = __DIR__ . '/submissions';
if (!file_exists($targetDir)) {
    mkdir($targetDir, 0755, true);
}

// Rate limiting: max 3 submissions per IP per day
$ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
$today = date('Y-m-d');
$rateLimitFile = $targetDir . '/.rate_limits.json';
$rateLimits = [];

if (file_exists($rateLimitFile)) {
    $rateLimits = json_decode(file_get_contents($rateLimitFile), true) ?? [];
}

// Clean up old entries from previous days
foreach ($rateLimits as $key => $count) {
    if (strpos($key, $today) !== 0) {
        unset($rateLimits[$key]);
    }
}

$rateKey = $today . '_' . $ip;
$currentCount = $rateLimits[$rateKey] ?? 0;

if ($currentCount >= 3) {
    echo json_encode([
        'success' => false,
        'message' => 'You have reached the maximum limit of 3 requests per day.'
    ]);
    exit;
}

// Clean full name for safe file naming while preserving readability
// Replace slashes or dangerous OS path characters with spaces/underscores
$safeName = preg_replace('/[^\w\s\d\-\p{Arabic}]/u', '', $fullName);
$safeName = preg_replace('/\s+/', '_', trim($safeName));

if (empty($safeName)) {
    $safeName = 'submission_' . time();
}

$filename = $safeName . '.json';
$filePath = $targetDir . '/' . $filename;

// Handle potential filename collision by appending timestamp
if (file_exists($filePath)) {
    $filename = $safeName . '_' . date('Ymd_His') . '.json';
    $filePath = $targetDir . '/' . $filename;
}

// Data payload
$submissionData = [
    'full_name' => $fullName,
    'phone' => $phone,
    'level' => $level,
    'submitted_at' => date('Y-m-d H:i:s'),
    'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? ''
];

$jsonContent = json_encode($submissionData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

if (file_put_contents($filePath, $jsonContent) !== false) {
    // Record successful rate limit attempt
    $rateLimits[$rateKey] = $currentCount + 1;
    file_put_contents($rateLimitFile, json_encode($rateLimits));

    echo json_encode([
        'success' => true,
        'message' => 'Your request has been received. We\'ll be in touch with your invitation soon.',
        'file' => $filename
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to save submission. Please try again.'
    ]);
}
