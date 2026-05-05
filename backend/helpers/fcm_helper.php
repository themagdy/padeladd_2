<?php
/**
 * FCMHelper - Lightweight wrapper for Firebase Cloud Messaging v1 API
 * Handles JWT authentication and sending push notifications to users.
 */

class FCMHelper {
    private static $credentials_path = __DIR__ . '/../core/firebase_credentials.json';

    /**
     * Sends a push notification to all devices registered to a specific user.
     * @param int $to_user_id The recipient user ID
     * @param string $title The notification title
     * @param string $body The notification body
     * @param array $data Optional metadata (must be key-value strings)
     */
    public static function send($to_user_id, $title, $body, $data = []) {
        $tokens = self::getUserTokens($to_user_id);
        if (empty($tokens)) {
            error_log("[FCM] No tokens found for user $to_user_id");
            return false;
        }

        $access_token = self::getAccessToken();
        if (!$access_token) {
            error_log("[FCM] Failed to generate access token");
            return false;
        }

        $project_id = self::getProjectId();
        $url = "https://fcm.googleapis.com/v1/projects/{$project_id}/messages:send";

        $results = [];
        foreach ($tokens as $token) {
            $payload = [
                'message' => [
                    'token' => $token,
                    'notification' => [
                        'title' => (string)$title,
                        'body' => (string)$body
                    ],
                    'data' => !empty($data) ? array_map('strval', $data) : new stdClass()
                ]
            ];

            // Add standard sound for Android/iOS
            $payload['message']['android'] = ['notification' => ['sound' => 'default']];
            $payload['message']['apns'] = ['payload' => ['aps' => ['sound' => 'default']]];

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $access_token,
                'Content-Type: application/json'
            ]);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            $response = curl_exec($ch);
            $results[] = json_decode($response, true);
            curl_close($ch);
        }
        
        return $results;
    }

    private static function getUserTokens($user_id) {
        $pdo = getDB();
        $stmt = $pdo->prepare("SELECT token FROM user_device_tokens WHERE user_id = ?");
        $stmt->execute([$user_id]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    private static function getProjectId() {
        if (!file_exists(self::$credentials_path)) return null;
        $json = json_decode(file_get_contents(self::$credentials_path), true);
        return $json['project_id'] ?? null;
    }

    /**
     * Generates an OAuth2 access token using the Service Account JSON
     * Uses RS256 JWT signing (pure PHP + OpenSSL)
     */
    private static function getAccessToken() {
        if (!file_exists(self::$credentials_path)) return null;
        $json = json_decode(file_get_contents(self::$credentials_path), true);
        if (!$json) return null;

        $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
        $now = time();
        $payload = json_encode([
            'iss' => $json['client_email'],
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => 'https://oauth2.googleapis.com/token',
            'exp' => $now + 3600,
            'iat' => $now
        ]);

        $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

        $signature = '';
        if (!openssl_sign($base64UrlHeader . "." . $base64UrlPayload, $signature, $json['private_key'], 'SHA256')) {
            return null;
        }
        $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

        $jwt = $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/token');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        curl_close($ch);

        $res = json_decode($response, true);
        return $res['access_token'] ?? null;
    }
}
