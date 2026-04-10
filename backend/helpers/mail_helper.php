<?php

function sendEmail($to, $subject, $content, $actionText = null, $actionUrl = null) {
    $fromEmail = 'noreply@ahmedmagdy.com';
    
    // Exact same plain-text format that worked in the test
    $message = $content . "\n\n";
    if ($actionUrl) {
        $message .= $actionText . ": " . $actionUrl;
    }

    $headers = "From: Padeladd <noreply@ahmedmagdy.com>\r\n";
    $headers .= "Reply-To: noreply@ahmedmagdy.com\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    return mail($to, $subject, $message, $headers);
}
?>
