<?php
/**
 * Twilio Helper for WhatsApp SMS/OTP
 * Uses direct REST API via CURL to avoid adding bulky SDK dependencies.
 */

function sendWhatsAppOTP($to, $code) {
    $sid = TWILIO_SID;
    $token = TWILIO_AUTH_TOKEN;
    $from = TWILIO_WHATSAPP_FROM;

    // Format number to E.164 (Assuming Egypt +20 if it starts with 01)
    if (strpos($to, '01') === 0 && strlen($to) === 11) {
        $to = '+20' . substr($to, 1);
    } elseif (strpos($to, '+') !== 0) {
        // Fallback for other formats if needed, but project uses Egyptian 01...
        $to = '+' . ltrim($to, '0');
    }

    $message = "Your Padeladd verification code is: $code. Valid for 24 hours.";

    $url = "https://api.twilio.com/2010-04-01/Accounts/$sid/Messages.json";

    $data = [
        'From' => $from,
        'To' => 'whatsapp:' . $to,
        'Body' => $message
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, "$sid:$token");
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));

    // Disable SSL verification on local if needed (not recommended for production)
    $is_local = (isset($_SERVER['HTTP_HOST']) && ($_SERVER['HTTP_HOST'] === 'localhost' || $_SERVER['HTTP_HOST'] === 'localhost:8888'));
    if ($is_local) {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    }

    $response = curl_exec($ch);
    $error = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($error) {
        error_log("Twilio Curl Error: $error");
        return false;
    }

    $resData = json_decode($response, true);
    if ($httpCode >= 400) {
        $twilioMsg = $resData['message'] ?? 'Unknown Twilio Error';
        error_log("Twilio API Error ($httpCode): $twilioMsg");
        return false;
    }

    return true;
}
