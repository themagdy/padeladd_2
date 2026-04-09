<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../helpers/auth_helper.php';

echo json_encode([
    'getBearerToken_output' => getBearerToken(),
    'all_headers' => function_exists('getallheaders') ? getallheaders() : apache_request_headers(),
    'server_vars' => [
        'HTTP_AUTHORIZATION' => $_SERVER['HTTP_AUTHORIZATION'] ?? null,
        'REDIRECT_HTTP_AUTHORIZATION' => $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null,
        'Authorization' => $_SERVER['Authorization'] ?? null
    ]
]);
?>
