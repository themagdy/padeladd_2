<?php

function sendEmail($to, $subject, $content, $actionText = null, $actionUrl = null) {
    $fromEmail = 'noreply@ahmedmagdy.com';
    
    // HTML Email Template
    $logoUrl = 'https://ahmedmagdy.com/pl/assets/logo.png';
    
    // Handle line breaks for content
    $htmlContent = nl2br(htmlspecialchars($content));
    
    $buttonHtml = '';
    if ($actionUrl && $actionText) {
        $buttonHtml = '
        <div style="text-align: center; margin-top: 30px;">
            <a href="' . htmlspecialchars($actionUrl) . '" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                ' . htmlspecialchars($actionText) . '
            </a>
        </div>';
    }

    $message = '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { margin: 0; padding: 0; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; background-color: #0f172a; }
            .container { max-width: 600px; margin: 0 auto; background-color: #1e293b; padding: 40px; border-radius: 12px; margin-top: 40px; margin-bottom: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); }
            .header { text-align: center; margin-bottom: 30px; }
            .header img { max-height: 50px; }
            .content { color: #f8fafc; font-size: 16px; line-height: 1.6; }
            .footer { margin-top: 40px; text-align: center; color: #64748b; font-size: 13px; border-top: 1px solid #334155; padding-top: 20px; }
        </style>
    </head>
    <body style="background-color: #0f172a; padding: 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a;">
            <tr>
                <td align="center">
                    <div class="container" style="max-width: 600px; background-color: #1e293b; padding: 40px; border-radius: 12px; text-align: left;">
                        <div class="header">
                            <img src="' . $logoUrl . '" alt="Padeladd Logo" style="max-height: 50px;">
                        </div>
                        <div class="content">
                            ' . $htmlContent . '
                            ' . $buttonHtml . '
                        </div>
                        <div class="footer">
                            <p>This is an automated message from Padeladd. Please do not reply to this email.</p>
                            <p>&copy; ' . date("Y") . ' Padeladd. All rights reserved.</p>
                        </div>
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>';

    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: Padeladd <noreply@ahmedmagdy.com>\r\n";
    $headers .= "Reply-To: noreply@ahmedmagdy.com\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    return mail($to, $subject, $message, $headers);
}
?>
