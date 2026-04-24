<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../core/db.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_helper.php';
require_once __DIR__ . '/../helpers/mail_helper.php';
require_once __DIR__ . '/../helpers/notification_helper.php';

// Parse the request URI to determine endpoint
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Base path could be /padeladd4/backend/api or /padeladd4/api, let's just match the suffix
// Wait, CONFIG.API_BASE_URL is '/backend/api'.
// Endpoints expected: /register, /login, /verify-email, etc.
$endpoint = str_replace(dirname($_SERVER['SCRIPT_NAME']), '', $requestUri);
$endpoint = trim($endpoint, '/');

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Only POST method is allowed.', null, 405);
}

// Get payload
$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true) ?: [];

// Merge with POST data (for multipart/form-data)
if (!empty($_POST)) {
    $data = array_merge($data, $_POST);
}

try {
    // Route to correct script
    switch ($endpoint) {
        case 'register':
            require __DIR__ . '/auth/register.php';
            break;
        case 'verify-email':
            require __DIR__ . '/auth/verify_email.php';
            break;
        case 'verify-otp':
            require __DIR__ . '/auth/verify_otp.php';
            break;
        case 'verify-email-link':
            require __DIR__ . '/auth/verify_email_link.php';
            break;
        case 'check-verification':
            require __DIR__ . '/auth/check_verification.php';
            break;
        case 'login':
            require __DIR__ . '/auth/login.php';
            break;
        case 'logout':
            require __DIR__ . '/auth/logout.php';
            break;
        case 'forgot-password':
            require __DIR__ . '/auth/forgot_password.php';
            break;
        case 'reset-password':
            require __DIR__ . '/auth/reset_password.php';
            break;
        case 'profile/update':
            require __DIR__ . '/profile/update.php';
            break;
        case 'profile/get':
            require __DIR__ . '/profile/get.php';
            break;
        case 'profile/check_code':
            require __DIR__ . '/profile/check_code.php';
            break;
        case 'profile/upload_image':
            require __DIR__ . '/profile/upload_image.php';
            break;
        case 'profile/remove_image':
            require __DIR__ . '/profile/remove_image.php';
            break;
        case 'stats/get':
            require __DIR__ . '/stats/get.php';
            break;
        case 'matches/user':
            require __DIR__ . '/matches/user.php';
            break;
        // ── Phase 3: Match System ──────────────────────────────
        case 'match/venues':
            require __DIR__ . '/match/venues.php';
            break;
        case 'match/create':
            require __DIR__ . '/match/create.php';
            break;
        case 'match/list':
            require __DIR__ . '/match/list.php';
            break;
        case 'match/details':
            require __DIR__ . '/match/details.php';
            break;
        case 'match/join-solo':
            require __DIR__ . '/match/join-solo.php';
            break;
        case 'match/join-team':
            require __DIR__ . '/match/join-team.php';
            break;
        case 'match/approve':
            require __DIR__ . '/match/approve.php';
            break;
        case 'match/deny':
            require __DIR__ . '/match/deny.php';
            break;
        case 'match/block':
            require __DIR__ . '/match/block.php';
            break;
        case 'match/withdraw':
            require __DIR__ . '/match/withdraw.php';
            break;
        case 'match/cancel':
            require __DIR__ . '/match/cancel.php';
            break;
        case 'match/jump-in':
            require __DIR__ . '/match/jump-in.php';
            break;
        // ── Phase 4: Match Actions & Rules ─────────────────────────────────
        case 'match/eligibility-check':
            require __DIR__ . '/match/eligibility-check.php';
            break;
        // ── Phase 5: Communication Layer ─────────────────────────────────
        case 'chat/send':
            require __DIR__ . '/chat/send.php';
            break;
        case 'chat/list':
            require __DIR__ . '/chat/list.php';
            break;
        case 'chat/heartbeat':
            require __DIR__ . '/chat/heartbeat.php';
            break;
        case 'chat/presence-clear':
            require __DIR__ . '/chat/presence-clear.php';
            break;
        case 'phone/request':
            require __DIR__ . '/phone/request.php';
            break;
        case 'phone/respond':
            require __DIR__ . '/phone/respond.php';
            break;
        case 'phone/cancel':
            require __DIR__ . '/phone/cancel.php';
            break;
        // ── Phase 6: Notifications ──────────────────────────────────────
        case 'notifications/list':
            require __DIR__ . '/notifications/list.php';
            break;
        case 'notifications/read':
            require __DIR__ . '/notifications/read.php';
            break;
        // ── Phase 7: Scoring ──────────────────────────────────────
        case 'score/submit':
            require __DIR__ . '/score/submit.php';
            break;
        case 'score/approve':
            require __DIR__ . '/score/approve.php';
            break;
        case 'score/dispute':
            require __DIR__ . '/score/dispute.php';
            break;
        case 'match/report':
            require __DIR__ . '/match/report.php';
            break;
        case 'ranking/list':
            require __DIR__ . '/ranking/list.php';
            break;

        default:
            jsonResponse(false, 'Endpoint not found: ' . $endpoint, null, 404);
    }
} catch (\Throwable $e) {
    error_log("API Error [" . $endpoint . "]: " . $e->getMessage());
    jsonResponse(false, 'Internal server error: ' . $e->getMessage(), null, 500);
}
