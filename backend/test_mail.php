<?php
define('SITE_URL', 'https://ahmedmagdy.com/pl'); // Temporary for testing

echo "<h1>Mail Diagnostic - Iteration 2</h1>";

$to = 'aworking@gmail.com';
$subject = "Padeladd Diagnostic - " . date('H:i:s');
$fromEmail = 'no-reply@ahmedmagdy.com';
$siteName = 'Padeladd';

// Simplest possible HTML content to avoid spam filters
$message = "
<html>
<body>
    <h2 style='color: #f7941d;'>PADELADD</h2>
    <p>This is a manual diagnostic test to see which headers your server requires.</p>
    <p>Time sent: " . date('Y-m-d H:i:s') . "</p>
    <a href='https://ahmedmagdy.com/pl' style='background: #f7941d; color: black; padding: 10px 20px; text-decoration: none;'>Verify Email</a>
</body>
</html>
";

// TRYING BASIC HEADERS
$headers = "From: $siteName <$fromEmail>\r\n";
$headers .= "Reply-To: $fromEmail\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-type: text/html; charset=UTF-8\r\n";

echo "Attempting to send to: <b>$to</b>...<br>";

// We use the 5th parameter -f which is often CRITICAL
$result = mail($to, $subject, $message, $headers, "-f $fromEmail");

if ($result) {
    echo "<span style='color: green; font-weight: bold;'>SUCCESS!</span> Server accepted mail.<br>";
} else {
    echo "<span style='color: red; font-weight: bold;'>FAILED!</span> Server rejected mail.<br>";
}
?>
