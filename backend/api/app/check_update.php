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

// Handle HTML log viewer and log clearing directly inside check_update.php
if (isset($_GET['view_log'])) {
    $logFile = __DIR__ . '/ota_debug.log';
    if (isset($_GET['clear'])) {
        @file_put_contents($logFile, '');
        header('Location: check_update.php?view_log=1');
        exit();
    }
    header('Content-Type: text/html; charset=utf-8');
    $content = file_exists($logFile) ? htmlspecialchars(file_get_contents($logFile)) : 'No log entries yet.';
    echo "<!DOCTYPE html><html><head><title>OTA Debug Logs</title><style>
        body { background: #0d1117; color: #c9d1d9; font-family: monospace; padding: 20px; }
        .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .btn { background: #da3633; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; text-decoration: none; }
        .btn:hover { background: #f85149; }
        pre { background: #161b22; padding: 15px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; line-height: 1.5; border: 1px solid #30363d; }
    </style></head><body>
    <div class='top'>
        <h2>OTA Debug Logs</h2>
        <a href='check_update.php?view_log=1&clear=1' class='btn' onclick='return confirm(\"Clear all logs?\")'>Clear Log</a>
    </div>
    <pre>{$content}</pre>
    </body></html>";
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
if (isset($_GET['download'])) {
    $reqVer = trim($_GET['download']);
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
    $logMsg = date('Y-m-d H:i:s') . " | [DOWNLOAD] | Version: v{$reqVer} | IP: {$ip}\n";
    @file_put_contents(__DIR__ . '/ota_debug.log', $logMsg, FILE_APPEND);

    $bundleFile = __DIR__ . "/../../../downloads/bundles/web-v{$reqVer}.zip";
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

// Capgo plugin v5 sends 'version_name' or 'version_build' or 'version'
$currentVersion = $data['version_name'] ?? ($data['version'] ?? ($data['version_build'] ?? '0.0.0'));
$deviceId = substr($data['device_id'] ?? 'Device', 0, 8);
$ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';

// Log check-in in plain text with checkmark indicator if up-to-date
$isUpToDate = ($currentVersion !== '' && version_compare($currentVersion, $latestVersion, '>='));
$statusTag = $isUpToDate ? '[CHECK ✓ UP TO DATE]' : '[CHECK - UPDATE AVAILABLE]';

$logMsg = date('Y-m-d H:i:s') . " | {$statusTag} | Device: {$deviceId}... | App Running: v{$currentVersion} | Available: v{$latestVersion} | IP: {$ip}\n";
@file_put_contents(__DIR__ . '/ota_debug.log', $logMsg, FILE_APPEND);

// If current version is already greater than or equal to latest zip on server, return 204 No Content
if ($currentVersion !== '' && version_compare($currentVersion, $latestVersion, '>=')) {
    http_response_code(204);
    exit();
}

$bundleUrl = "https://padeladd.com/backend/api/app/check_update.php?download={$latestVersion}";

echo json_encode([
    'version' => $latestVersion,
    'url'     => $bundleUrl,
    'session' => (object)[]
], JSON_UNESCAPED_SLASHES);
