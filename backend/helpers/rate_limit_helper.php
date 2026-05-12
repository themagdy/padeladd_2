<?php
/**
 * Rate Limiting Helper
 *
 * Tracks failed attempts per key (IP or user ID) in the rate_limits table.
 * Fails OPEN on any DB error — never blocks a legitimate user due to infrastructure issues.
 *
 * Usage:
 *   checkRateLimit($pdo, 'login_' . $ip, 10, 600);    // max 10 per 10 min
 *   recordAttempt($pdo, 'login_' . $ip);               // call on failure only
 */

function checkRateLimit($pdo, $key, $maxAttempts, $windowSeconds) {
    try {
        $stmt = $pdo->prepare("SELECT attempts, window_start FROM rate_limits WHERE limit_key = ? LIMIT 1");
        $stmt->execute([$key]);
        $row = $stmt->fetch();

        if ($row) {
            $windowStart = strtotime($row['window_start']);
            $now = time();

            if (($now - $windowStart) < $windowSeconds) {
                // Within the active window — check if limit exceeded
                if ((int)$row['attempts'] >= $maxAttempts) {
                    $retryAfter = $windowSeconds - ($now - $windowStart);
                    header('Retry-After: ' . $retryAfter);
                    jsonResponse(false, 'Too many attempts. Please try again later.', null, 429);
                }
            } else {
                // Window expired — reset
                $pdo->prepare("DELETE FROM rate_limits WHERE limit_key = ?")->execute([$key]);
            }
        }
    } catch (\Throwable $e) {
        error_log('[RateLimit] checkRateLimit error: ' . $e->getMessage());
        // Fail open — do not block user
    }
}

function recordAttempt($pdo, $key) {
    try {
        $stmt = $pdo->prepare("SELECT id FROM rate_limits WHERE limit_key = ? LIMIT 1");
        $stmt->execute([$key]);
        $row = $stmt->fetch();

        if ($row) {
            $pdo->prepare("UPDATE rate_limits SET attempts = attempts + 1 WHERE id = ?")
                ->execute([$row['id']]);
        } else {
            $pdo->prepare("INSERT INTO rate_limits (limit_key, attempts, window_start) VALUES (?, 1, NOW())")
                ->execute([$key]);
        }
    } catch (\Throwable $e) {
        error_log('[RateLimit] recordAttempt error: ' . $e->getMessage());
    }
}
?>
