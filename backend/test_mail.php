<?php
echo "<h1>Mail Diagnostic - Iteration 4 (Bare Minimum)</h1>";

$to = 'aworking@gmail.com';
$subject = "Padeladd Minimal Test";
$fromEmail = 'no-reply@padeladd.com'; // Trying a different sender name

$message = "Test message from Padeladd app.\nIf you received this, the minimal style is working.";

// Absolute minimum header - exactly like a 5-line contact form
$headers = "From: " . $fromEmail;

echo "Attempting BARE MINIMUM send to: <b>$to</b> from <b>$fromEmail</b>...<br>";

$result = mail($to, $subject, $message, $headers);

if ($result) {
    echo "<span style='color: green; font-weight: bold;'>SUCCESS!</span> Bare minimum mail accepted.<br>";
} else {
    echo "<span style='color: red; font-weight: bold;'>FAILED!</span>";
}
?>
