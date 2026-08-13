<?php
/**
 * POST /api/app/check_update
 * Endpoint for Capgo Capacitor Updater (@capgo/capacitor-updater)
 * Returns the latest web build bundle metadata or 204 No Content if up-to-date.
 */
header('Content-Type: application/json; charset=utf-8');

$versionFile = __DIR__ . '/../../../version.txt';
$latestVersion = '2.4.86';
if (file_exists($versionFile)) {
    $content = file_get_contents($versionFile);
    if (preg_match('/Version\s+([0-9\.]+)/i', $content, $m)) {
        $latestVersion = trim($m[1]);
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

// Return latest bundle details if newer version exists
$bundleUrl = "https://padeladd.com/downloads/bundles/web-v{$latestVersion}.zip";

echo json_encode([
    'version' => $latestVersion,
    'url'     => $bundleUrl,
    'session' => [
        'checksum' => ''
    ]
], JSON_UNESCAPED_SLASHES);
