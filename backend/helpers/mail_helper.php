<?php

function sendEmail($to, $subject, $content, $actionText = null, $actionUrl = null) {
    $siteName = 'Padeladd';
    $siteUrl = SITE_URL;
    $fromEmail = 'no-reply@ahmedmagdy.com';
    
    // Premium Dark Theme HTML Template
    $html = "
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f1218; margin: 0; padding: 0; color: #ffffff; }
            .container { max-width: 600px; margin: 40px auto; background-color: #1a1e26; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .header { background-color: #171c26; padding: 40px 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); }
            .logo { color: #f7941d; font-size: 28px; font-weight: bold; letter-spacing: 1px; }
            .body { padding: 40px; line-height: 1.6; }
            .greeting { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
            .message { font-size: 16px; color: #b0b3b8; margin-bottom: 30px; }
            .btn-container { text-align: center; margin-top: 30px; }
            .btn { background-color: #f7941d; color: #000000 !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; display: inline-block; transition: background 0.3s; }
            .footer { background-color: #171c26; padding: 20px; text-align: center; font-size: 12px; color: #65676b; border-top: 1px solid rgba(255,255,255,0.05); }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <div class='logo'>PADELADD</div>
            </div>
            <div class='body'>
                <div class='greeting'>Hello,</div>
                <div class='message'>$content</div>
                " . ($actionUrl ? "
                <div class='btn-container'>
                    <a href='$actionUrl' class='btn'>$actionText</a>
                </div>" : "") . "
            </div>
            <div class='footer'>
                &copy; " . date('Y') . " $siteName. All rights reserved.<br>
                This is an automated email, please do not reply.
            </div>
        </div>
    </body>
    </html>
    ";

    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= "From: $siteName <$fromEmail>" . "\r\n";

    return mail($to, $subject, $html, $headers);
}
?>
