<?php
/**
 * Match Social Share Page
 * URL: /share/M-334  (rewritten by .htaccess as ?code=M-334)
 * - Outputs dynamic OG meta tags for WhatsApp/social crawlers
 * - Redirects real users to the app deep link
 */

// Load config (DB credentials)
require_once __DIR__ . '/../backend/core/config.php';

// Match code passed via ?code= from .htaccess rewrite
$matchCode = strtoupper(trim($_GET['code'] ?? ''));

// Defaults
$ogTitle       = 'Padeladd – Compete. Climb. Dominate.';
$ogDescription = 'Join the padel community. Play, rank, and track your matches.';
$ogImage       = 'https://padeladd.com/assets/padeladd_share_thumb.jpg';
$appDeepLink   = 'https://padeladd.com';
$canonicalUrl  = 'https://padeladd.com';

if (!empty($matchCode)) {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $opts = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $opts);
        } catch (PDOException $e) {
            // MAMP socket fallback
            $dsn2 = "mysql:unix_socket=/Applications/MAMP/tmp/mysql/mysql.sock;dbname=" . DB_NAME . ";charset=utf8mb4";
            $pdo = new PDO($dsn2, DB_USER, DB_PASS, $opts);
        }
        $pdo->exec("SET time_zone = '+03:00'");

        $stmt = $pdo->prepare("
            SELECT m.match_code, m.match_datetime, m.status, m.match_type,
                   COALESCE(v.name, 'TBD') AS venue_name
            FROM matches m
            LEFT JOIN venues v ON m.venue_id = v.id
            WHERE m.match_code = ?
            LIMIT 1
        ");
        $stmt->execute([$matchCode]);
        $match = $stmt->fetch();

        if ($match) {
            $code        = $match['match_code'];
            $status      = $match['status'];
            $venue       = explode(' - ', $match['venue_name'])[0]; // strip court suffix
            $matchType   = $match['match_type'] === 'competition' ? 'Competition' : 'Friendly';
            $isCompleted = $status === 'completed';

            // Format date/time
            $dt      = new DateTime($match['match_datetime'], new DateTimeZone('Africa/Cairo'));
            $dateStr = $dt->format('D, j M') . ' at ' . $dt->format('g:i A');

            // Title
            $ogTitle = $isCompleted
                ? "Watch Padeladd Match {$code}"
                : "Join my Padeladd Match";

            // Description: type • venue • date/time
            $ogDescription = "{$matchType} • {$venue} • {$dateStr}";

            // Deep link & canonical
            $appDeepLink  = "https://padeladd.com/matches/{$code}";
            $canonicalUrl = $appDeepLink;
        }
    } catch (Exception $e) {
        error_log('[share/match.php] DB error: ' . $e->getMessage());
        // Fall through to defaults
    }
}

// Detect crawlers (WhatsApp, Facebook, Telegram, Slack, etc.)
$ua        = $_SERVER['HTTP_USER_AGENT'] ?? '';
$isCrawler = (bool) preg_match('/whatsapp|facebookexternalhit|twitterbot|telegrambot|slackbot|iframely|linkedinbot|discordbot|applebot|googlebot|bingbot|curl|wget/i', $ua);

if (!$isCrawler) {
    header("Location: {$appDeepLink}", true, 302);
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($ogTitle) ?></title>

    <!-- Open Graph (WhatsApp, Facebook, iMessage) -->
    <meta property="og:type"         content="website">
    <meta property="og:url"          content="<?= htmlspecialchars($canonicalUrl) ?>">
    <meta property="og:title"        content="<?= htmlspecialchars($ogTitle) ?>">
    <meta property="og:description"  content="<?= htmlspecialchars($ogDescription) ?>">
    <meta property="og:image"        content="<?= htmlspecialchars($ogImage) ?>">
    <meta property="og:image:width"  content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name"    content="Padeladd">

    <!-- Twitter Card -->
    <meta name="twitter:card"        content="summary_large_image">
    <meta name="twitter:title"       content="<?= htmlspecialchars($ogTitle) ?>">
    <meta name="twitter:description" content="<?= htmlspecialchars($ogDescription) ?>">
    <meta name="twitter:image"       content="<?= htmlspecialchars($ogImage) ?>">

    <!-- Canonical -->
    <link rel="canonical" href="<?= htmlspecialchars($canonicalUrl) ?>">

    <!-- JS redirect for real users who land here -->
    <meta http-equiv="refresh" content="0;url=<?= htmlspecialchars($appDeepLink) ?>">
</head>
<body>
    <p>Redirecting to PadelAdd...</p>
</body>
</html>
