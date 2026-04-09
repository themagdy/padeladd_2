<?php
function jsonResponse($success, $message, $data = null, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => (bool)$success,
        'message' => (string)$message,
        'data' => $data
    ]);
    exit;
}
?>
