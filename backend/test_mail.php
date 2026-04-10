<?php
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/mail_helper.php';

// Change this to YOUR email address to test
$testEmail = 'themagdy@gmail.com'; 

echo "<h1>Mail Diagnostic</h1>";
echo "Attempting to send a test email to: <b>$testEmail</b>...<br><br>";

$result = sendEmail($testEmail, "Padeladd Test Diagnostic", "If you are reading this, your server is capable of sending HTML emails!", "Visit Site", "https://ahmedmagdy.com/pl");

if ($result) {
    echo "<span style='color: green; font-weight: bold;'>SUCCESS!</span> The server accepted the mail for delivery.<br>";
    echo "<i>Note: If you don't see it, check your SPAM/Junk folder.</i>";
} else {
    echo "<span style='color: red; font-weight: bold;'>FAILED!</span> The PHP mail() function returned FALSE.<br>";
    echo "Possible reasons:<br>";
    echo "1. The host has disabled mail() function.<br>";
    echo "2. The 'From' address needs to be exactly an email hosted on this domain (e.g. info@ahmedmagdy.com).<br>";
}
?>
