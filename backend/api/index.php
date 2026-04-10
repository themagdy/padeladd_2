<?php
// Simple API Router
require_once __DIR__ . '/../core/db.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_helper.php';
require_once __DIR__ . '/../helpers/mail_helper.php';

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

// Get JSON payload
$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true) ?: [];

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
    default:
        jsonResponse(false, 'Endpoint not found: ' . $endpoint, null, 404);
}
