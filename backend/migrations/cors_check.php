<?php
/**
 * CORS Diagnostic — Reveals what HTTP_ORIGIN the server receives.
 * DELETE THIS FILE after the CORS fix is confirmed working.
 * Access: /pl/backend/migrations/cors_check.php
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

echo json_encode([
    'HTTP_ORIGIN'       => $_SERVER['HTTP_ORIGIN'] ?? '(not set)',
    'HTTP_HOST'         => $_SERVER['HTTP_HOST'] ?? '(not set)',
    'HTTP_REFERER'      => $_SERVER['HTTP_REFERER'] ?? '(not set)',
    'REMOTE_ADDR'       => $_SERVER['REMOTE_ADDR'] ?? '(not set)',
    'REQUEST_METHOD'    => $_SERVER['REQUEST_METHOD'] ?? '(not set)',
    'SERVER_NAME'       => $_SERVER['SERVER_NAME'] ?? '(not set)',
]);
?>
