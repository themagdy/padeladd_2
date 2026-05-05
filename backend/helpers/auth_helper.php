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

    $stmt = $pdo->prepare("
        SELECT u.*, up.nickname 
        FROM users u
        JOIN user_sessions us ON u.id = us.user_id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE us.token = ? AND u.status = 'active'
    ");
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonResponse(false, 'Unauthorized. Invalid or expired token.', null, 401);
    }
    
    return $user;
}
function generateUniquePlayerCode($pdo) {
    // Exclude confusing characters: 0, o, O, s, S, 5, i, 1, l
    $letters = 'ABCDEFGHJKMNPQRTUVWXYZ'; // Excludes I, L, O, S
    $digits  = '2346789';              // Excludes 0, 1, 5
    
    $numDigits = 2; // Start with 2 digits (e.g., M23)
    
    while ($numDigits < 10) { // Safety limit of 10 digits
        $totalPossible = strlen($letters) * pow(strlen($digits), $numDigits);
        
        // Count how many codes of this specific length (1 letter + N digits) exist
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM user_profiles WHERE LENGTH(player_code) = ?");
        $stmtCount->execute([$numDigits + 1]);
        $usedCount = (int)$stmtCount->fetchColumn();
        
        if ($usedCount < $totalPossible) {
            // There is still room in this "digit pool"
            $checkCode = $pdo->prepare("SELECT id FROM user_profiles WHERE player_code = ?");
            
            // Try to find a unique random code
            for ($attempt = 0; $attempt < 200; $attempt++) {
                $letter = $letters[random_int(0, strlen($letters) - 1)];
                $code   = strtoupper($letter);
                for ($i = 0; $i < $numDigits; $i++) {
                    $code .= $digits[random_int(0, strlen($digits) - 1)];
                }
                
                $checkCode->execute([$code]);
                if ($checkCode->rowCount() == 0) return $code;
            }
        }
        
        // If this pool is full (or we couldn't find a random gap), move to the next size
        $numDigits++;
    }

    return null;
}

?>
