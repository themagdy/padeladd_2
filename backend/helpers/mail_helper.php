<?php

function sendEmail($to, $subject, $content, $actionText = null, $actionUrl = null) {
    $siteName = 'Padeladd';
    $siteUrl = SITE_URL;
    $fromEmail = 'themagdy@ahmedmagdy.com';
    
    // Premium Dark Theme HTML Template
    $html = "
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: sans-serif; background-color: #0f1218; margin: 0; padding: 0; color: #ffffff; }
            .container { max-width: 600px; margin: 20px auto; background-color: #1a1e26; padding: 40px; border-radius: 12px; }
            .logo { color: #f7941d; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            .message { color: #b0b3b8; line-height: 1.6; margin-bottom: 30px; }
            .btn { background-color: #f7941d; color: #000000 !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block; }
            .footer { margin-top: 40px; font-size: 12px; color: #65676b; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='logo'>PADELADD</div>
            <p class='message'>$content</p>
            " . ($actionUrl ? "
            <p><a href='$actionUrl' class='btn'>$actionText</a></p>" : "") . "
            <div class='footer'>
                &copy; " . date('Y') . " $siteName. Automated email.
            </div>
        </div>
    </body>
    </html>
    ";

    $headers = "From: $fromEmail\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8\r\n";

    return mail($to, $subject, $html, $headers);
}
?>
