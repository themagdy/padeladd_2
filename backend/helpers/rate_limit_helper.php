<?php
/**
 * Rate Limiting Helper
 * 
 * Tracks attempts per key (IP or user ID) in the rate_limits table.
 * Usage:
 *   checkRateLimit($pdo, 'login_' . $ip, 10, 600);   // 10 attempts per 10 min
 *   recordAttempt($pdo, 'login_' . $ip);
 */

/**
 * Check if the rate limit has been exceeded for a given key.
 * If exceeded, sends a 429 JSON response and exits.
 *
 * @param PDO    $pdo
 * @param string $key          Unique key (e.g., 'login_192.168.1.1' or 'otp_42')
 * @param int    $maxAttempts  Max allowed attempts within the window
 * @param int    $windowSeconds Time window in seconds
 */
function checkRateLimit($pdo, $key, $maxAttempts, $windowSeconds) {
    try {
        $stmt = $pdo->prepare("
            SELECT attempts, window_start 
            FROM rate_limits 
            WHERE limit_key = ? 
            LIMIT 1
        ");
        $stmt->execute([$key]);
        $row = $stmt->fetch();

        if ($row) {
            $windowStart = strtotime($row['window_start']);
            $now = time();

            if (($now - $windowStart) < $windowSeconds) {
                // Still within the current window
                if ((int)$row['attempts'] >= $maxAttempts) {
                    $retryAfter = $windowSeconds - ($now - $windowStart);
                    header('Retry-After: ' . $retryAfter);
                    jsonResponse(false, 'Too many attempts. Please try again later.', null, 429);
                }
            } else {
                // Window has expired — reset the counter
                $pdo->prepare("DELETE FROM rate_limits WHERE limit_key = ?")->execute([$key]);
            }
        }
    } catch (\Throwable $e) {
        // If rate limit table doesn't exist yet or any DB error,
        // log it but do NOT block the user — fail open for safety.
        error_log('[RateLimit] Error checking rate limit: ' . $e->getMessage());
    }
}

/**
 * Record a failed attempt for a given key.
 *
 * @param PDO    $pdo
 * @param string $key
 */
function recordAttempt($pdo, $key) {
    try {
        $existing = $pdo->prepare("SELECT id, attempts FROM rate_limits WHERE limit_key = ? LIMIT 1");
        $existing->execute([$key]);
        $row = $existing->fetch();

        if ($row) {
            $pdo->prepare("UPDATE rate_limits SET attempts = attempts + 1 WHERE id = ?")
                ->execute([$row['id']]);
        } else {
            $pdo->prepare("INSERT INTO rate_limits (limit_key, attempts, window_start) VALUES (?, 1, NOW())")
                ->execute([$key]);
        }
    } catch (\Throwable $e) {
        error_log('[RateLimit] Error recording attempt: ' . $e->getMessage());
    }
}
?>
