<?php
/**
 * Match Social Share Page
 * URL: /share/M-334
 * - Renders OG meta tags for WhatsApp/social crawlers
 * - Redirects real users to the app deep link
 */

require_once __DIR__ . '/../backend/core/db.php';

// Match code is passed as ?code=M-XXX by the .htaccess rewrite rule
$matchCode = strtoupper(trim($_GET['code'] ?? ''));

// Defaults
$ogTitle       = 'PadelAdd – Play Padel';
$ogDescription = 'Join the padel community. Book, play, and track your matches.';
$ogImage       = 'https://padeladd.com/assets/padeladd_share_thumb.jpg';
$appDeepLink   = 'https://padeladd.com';
$canonicalUrl  = 'https://padeladd.com';

if (!empty($matchCode)) {
    try {
        $pdo = getDB();
        $stmt = $pdo->prepare("
            SELECT m.match_code, m.match_datetime, m.status, m.match_type,
                   COALESCE(v.name, m.venue) AS venue_name
            FROM matches m
            LEFT JOIN venues v ON m.venue_id = v.id
            WHERE m.match_code = ?
            LIMIT 1
        ");
        $stmt->execute([$matchCode]);
        $match = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($match) {
            $code        = $match['match_code'];
            $status      = $match['status'];
            $venue       = $match['venue_name'] ?: 'TBD';
            $venue       = explode(' - ', $venue)[0]; // strip court suffix
            $matchType   = $match['match_type'] === 'competition' ? 'Competition' : 'Friendly';
            $isCompleted = $status === 'completed';

            // Format date/time
            $dt = new DateTime($match['match_datetime'], new DateTimeZone('Africa/Cairo'));
            $dateStr = $dt->format('D, j M') . ' at ' . $dt->format('g:i A');

            // Title
            if ($isCompleted) {
                $ogTitle = "Watch PadelAdd Match {$code}";
            } else {
                $ogTitle = "Join my PadelAdd Match";
            }

            // Description
            $ogDescription = "{$matchType} • {$venue} • {$dateStr}";

            // Deep link & canonical
            $appDeepLink = "https://padeladd.com/matches/{$code}";
            $canonicalUrl = $appDeepLink;
        }
    } catch (Exception $e) {
        // Silently fall back to defaults
    }
}

// Detect if this is a real user (not a crawler)
// Crawlers: WhatsApp, Facebook, Twitter, Telegram, Slack, iMessage
$ua = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
$isCrawler = preg_match('/whatsapp|facebookexternalhit|twitterbot|telegrambot|slackbot|iframely|linkedinbot|discordbot|applebot|googlebot|bingbot|curl|wget/i', $ua);

if (!$isCrawler) {
    // Real user — redirect to the app
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
    <meta property="og:type"        content="website">
    <meta property="og:url"         content="<?= htmlspecialchars($canonicalUrl) ?>">
    <meta property="og:title"       content="<?= htmlspecialchars($ogTitle) ?>">
    <meta property="og:description" content="<?= htmlspecialchars($ogDescription) ?>">
    <meta property="og:image"       content="<?= htmlspecialchars($ogImage) ?>">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name"   content="PadelAdd">

    <!-- Twitter Card -->
    <meta name="twitter:card"        content="summary_large_image">
    <meta name="twitter:title"       content="<?= htmlspecialchars($ogTitle) ?>">
    <meta name="twitter:description" content="<?= htmlspecialchars($ogDescription) ?>">
    <meta name="twitter:image"       content="<?= htmlspecialchars($ogImage) ?>">

    <!-- Canonical -->
    <link rel="canonical" href="<?= htmlspecialchars($canonicalUrl) ?>">

    <!-- Redirect real users who land here (JS fallback) -->
    <meta http-equiv="refresh" content="0;url=<?= htmlspecialchars($appDeepLink) ?>">
</head>
<body>
    <p>Redirecting to PadelAdd...</p>
</body>
</html>
