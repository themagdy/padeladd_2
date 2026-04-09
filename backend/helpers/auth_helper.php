<?php
function generateRandomString($length = 32) {
    return bin2hex(random_bytes($length / 2));
}

function generateNumericCode($length = 6) {
    $code = '';
    for ($i = 0; $i < $length; $i++) {
        $code .= mt_rand(0, 9);
    }
    return $code;
}

function getBearerToken() {
    $headers = null;
    if (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER["Authorization"]);
    } else if (isset($_SERVER['HTTP_AUTHORIZATION'])) { // Nginx or fast CGI
        $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    } elseif (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders), array_fill(0, count($requestHeaders), '-')), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        }
    }
    if (!empty($headers)) {
        if (preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
            return $matches[1];
        }
    }
    return null;
}

function getAuthenticatedUser($pdo) {
    $token = getBearerToken();
    if (!$token) {
        jsonResponse(false, 'Unauthorized. Token missing.', null, 401);
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE auth_token = ? AND status = 'active'");
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(false, 'Unauthorized. Invalid or expired token.', null, 401);
    }
    
    return $user;
}
?>
