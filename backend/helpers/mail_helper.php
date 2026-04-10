<?php

function sendEmail($to, $subject, $content, $actionText = null, $actionUrl = null) {
    $fromEmail = 'no-reply@padeladd.com';
    
    // Exact same plain-text format that worked in the test
    $message = $content . "\n\n";
    if ($actionUrl) {
        $message .= $actionText . ": " . $actionUrl;
    }

    $headers = "From: Padeladd <no-reply@padeladd.com>\r\n";
    $headers .= "Reply-To: no-reply@padeladd.com\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    // Use -f with the actual hosted server email to bypass Bluehost spoofing protection
    return mail($to, $subject, $message, $headers, "-fthemagdy@ahmedmagdy.com");
}
?>
