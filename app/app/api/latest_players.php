<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../../../backend/core/db.php';

try {
    $pdo = getDB();
    
    // Fetch latest 6 FULLY VERIFIED non-admin registered users
    $stmt = $pdo->prepare("
        SELECT 
            u.id,
            u.first_name,
            u.last_name,
            up.nickname,
            up.profile_image_thumb,
            up.profile_image,
            up.player_code
        FROM users u
        INNER JOIN user_profiles up ON u.id = up.user_id
        WHERE u.is_email_verified = 1 
          AND u.is_phone_verified = 1
          AND u.id != 1000000
          AND (up.player_code IS NULL OR up.player_code != 'ADMIN')
          AND (u.status = 'active' OR u.status IS NULL)
        ORDER BY u.id DESC
        LIMIT 6
    ");
    
    $stmt->execute();
    $players = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $formatted = [];
    foreach ($players as $p) {
        $displayName = !empty($p['nickname']) ? $p['nickname'] : trim(($p['first_name'] ?? '') . ' ' . ($p['last_name'] ?? ''));
        if (empty($displayName)) {
            $displayName = 'Player';
        }
        
        $code = !empty($p['player_code']) ? $p['player_code'] : ('P-' . str_pad($p['id'], 4, '0', STR_PAD_LEFT));
        $initial = strtoupper(mb_substr($displayName, 0, 1));
        $image = !empty($p['profile_image_thumb']) ? $p['profile_image_thumb'] : ($p['profile_image'] ?? null);
        
        $formatted[] = [
            'id' => (int)$p['id'],
            'name' => $displayName,
            'code' => $code,
            'initial' => $initial,
            'image' => $image
        ];
    }
    
    echo json_encode([
        'status' => 'success',
        'data' => $formatted
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Failed to retrieve players'
    ]);
}
