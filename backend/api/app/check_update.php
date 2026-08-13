<?php
/**
 * POST /api/app/check_update
 * Secure Endpoint for Capgo Capacitor Updater (@capgo/capacitor-updater)
 * Validates request authentication token before returning bundle metadata or serving download.
 */
header('Content-Type: application/json; charset=utf-8');

$SECRET_TOKEN = 'pdl_sec_ota_8f92a471b0c9e';

// Get headers robustly across Nginx / Apache
$headers = function_exists('apache_request_headers') ? apache_request_headers() : (function_exists('getallheaders') ? getallheaders() : []);
$providedToken = $_SERVER['HTTP_X_APP_UPDATE_TOKEN'] ?? ($headers['X-App-Update-Token'] ?? ($headers['x-app-update-token'] ?? ''));

if ($providedToken !== $SECRET_TOKEN) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized access'], JSON_UNESCAPED_SLASHES);
    exit();
}

$bundlesDir = __DIR__ . '/../../../downloads/bundles';
$latestVersion = '0.0.0';

if (is_dir($bundlesDir)) {
    $files = scandir($bundlesDir);
    $versions = [];
    foreach ($files as $file) {
        if (preg_match('/^web-v([0-9\.]+)\.zip$/i', $file, $m)) {
            $versions[] = $m[1];
        }
    }
    if (!empty($versions)) {
        usort($versions, 'version_compare');
        $latestVersion = end($versions);
    }
}

// Handle secure bundle file download request
if (isset($_GET['download']) && $_GET['download'] === $latestVersion) {
    $bundleFile = __DIR__ . "/../../../downloads/bundles/web-v{$latestVersion}.zip";
    if (file_exists($bundleFile)) {
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="bundle.zip"');
        header('Content-Length: ' . filesize($bundleFile));
        readfile($bundleFile);
        exit();
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Bundle file not found']);
        exit();
    }
}

// Get request JSON payload from plugin
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: [];

$currentVersion = $data['version'] ?? '';

// If version matches latest build, return 204 No Content (Up to date)
if ($currentVersion === $latestVersion) {
    http_response_code(204);
    exit();
}

// Return secure authenticated download endpoint URL
$bundleUrl = "https://padeladd.com/backend/api/app/check_update.php?download={$latestVersion}";

echo json_encode([
    'version' => $latestVersion,
    'url'     => $bundleUrl,
    'session' => [
        'checksum' => ''
    ]
], JSON_UNESCAPED_SLASHES);
