<?php
echo "<h1>Mail Diagnostic - Iteration 3 (Plain Text)</h1>";

$to = 'aworking@gmail.com';
$subject = "Plain Text Test - " . date('H:i:s');
$fromEmail = 'no-reply@ahmedmagdy.com';

// Pure plain text - no HTML at all
$message = "This is Iteration 3.\n";
$message .= "If you see this, then simple plain text mails are working.\n";
$message .= "Time: " . date('Y-m-d H:i:s');

// Using \n (Linux Style) which is often required on many shared hosts
$headers = "From: Padeladd <$fromEmail>\n";
$headers .= "Reply-To: $fromEmail\n";
$headers .= "X-Mailer: PHP/" . phpversion();

echo "Attempting PLAIN TEXT send to: <b>$to</b>...<br>";

$result = mail($to, $subject, $message, $headers, "-f $fromEmail");

if ($result) {
    echo "<span style='color: green; font-weight: bold;'>SUCCESS!</span> Server accepted plain text mail.<br>";
} else {
    echo "<span style='color: red; font-weight: bold;'>FAILED!</span> Server rejected even plain text.<br>";
}
?>
