<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/PHPMailer/Exception.php';
require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';

function sendEmail($to, $subject, $content, $actionText = null, $actionUrl = null) {
    $logoUrl = 'https://padeladd.com/assets/logo.png';

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
    </head>
    <body style="margin: 0; padding: 20px; font-family: &quot;Helvetica Neue&quot;, Helvetica, Arial, sans-serif; background-color: #0f172a;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a;">
            <tr>
                <td align="center">
                    <div style="max-width: 600px; background-color: #1e293b; padding: 40px; border-radius: 12px; text-align: left; margin: 40px auto; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <img src="' . $logoUrl . '" alt="Padeladd Logo" style="max-height: 50px;">
                        </div>
                        <div style="color: #f8fafc; font-size: 16px; line-height: 1.6;">
                            ' . $htmlContent . '
                            ' . $buttonHtml . '
                        </div>
                        <div style="margin-top: 40px; text-align: center; color: #64748b; font-size: 13px; border-top: 1px solid #334155; padding-top: 20px;">
                            <p>This is an automated message from Padeladd. Please do not reply to this email.</p>
                            <p>&copy; ' . date("Y") . ' Padeladd. All rights reserved.</p>
                        </div>
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>';

    $mail = new PHPMailer(true);

    try {
        // Server settings
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;

        // Sender & recipient
        $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
        $mail->addAddress($to);
        $mail->addReplyTo(SMTP_FROM, SMTP_FROM_NAME);

        // Content
        $mail->isHTML(true);
        $mail->CharSet = 'UTF-8';
        $mail->Subject = $subject;
        $mail->Body    = $message;
        $mail->AltBody = strip_tags(str_replace('<br>', "\n", $htmlContent));

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("PHPMailer Error sending to {$to}: " . $mail->ErrorInfo);
        return false;
    }
}
?>
