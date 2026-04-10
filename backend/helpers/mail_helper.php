<?php

function sendEmail($to, $subject, $content, $actionText = null, $actionUrl = null) {
    $fromEmail = 'themagdy@ahmedmagdy.com';
    
    // Exact same plain-text format that worked in the test
    $message = $content . "\n\n";
    if ($actionUrl) {
        $message .= $actionText . ": " . $actionUrl;
    }

    $headers = "From: " . $fromEmail;

    return mail($to, $subject, $message, $headers);
}
?>
