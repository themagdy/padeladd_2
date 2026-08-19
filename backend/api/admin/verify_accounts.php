<?php
/**
 * GET/POST /api/admin/verify_accounts.php
 * Admin API to fetch pending user verifications and active codes, or manually verify accounts.
 */
require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/admin_auth.php';
require_once __DIR__ . '/../../helpers/response.php';

$pdo = getDB();
validateAdmin();

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: [];
$action = $data['action'] ?? ($_GET['action'] ?? 'list');

if ($action === 'manual_verify') {
    $userId = (int)($data['user_id'] ?? 0);
    $type = trim($data['type'] ?? 'all'); // email, phone, all

    if ($userId <= 0) {
        jsonResponse(false, 'Invalid user ID.', null, 422);
    }

    if ($type === 'email' || $type === 'all') {
        $stmt = $pdo->prepare("UPDATE users SET is_email_verified = 1 WHERE id = ?");
        $stmt->execute([$userId]);
    }
    if ($type === 'phone' || $type === 'all') {
        $stmt = $pdo->prepare("UPDATE users SET is_phone_verified = 1 WHERE id = ?");
        $stmt->execute([$userId]);
    }

    // Mark active verification codes as used
    $stmt = $pdo->prepare("UPDATE verification_codes SET is_used = 1 WHERE user_id = ?");
    $stmt->execute([$userId]);

    jsonResponse(true, 'User successfully verified.', ['user_id' => $userId]);
}

// Default action: List pending verifications
$current_host = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]";
$script_name = $_SERVER['SCRIPT_NAME'];
$base_dir = dirname(dirname(dirname($script_name))); // Go up to app root
if ($base_dir === '/' || $base_dir === '\\') $base_dir = '';
$dynamic_base_url = rtrim($current_host . $base_dir, '/');

$final_base_url = (defined('SITE_URL') && strpos(SITE_URL, 'localhost:8888') !== false && $_SERVER['HTTP_HOST'] !== 'localhost:8888') 
    ? $dynamic_base_url 
    : (defined('SITE_URL') ? rtrim(SITE_URL, '/') : $dynamic_base_url);

$stmt = $pdo->query("
    SELECT u.id, u.email, u.mobile, u.is_email_verified, u.is_phone_verified, u.first_name, u.last_name, u.created_at
    FROM users u 
    LEFT JOIN verification_codes v ON u.id = v.user_id 
    WHERE u.is_email_verified = 0 OR u.is_phone_verified = 0 OR (v.is_used = 0 AND v.id IS NOT NULL)
    GROUP BY u.id
    ORDER BY u.id DESC 
    LIMIT 30
");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

$result = [];
foreach ($users as $u) {
    $stmtCodes = $pdo->prepare("
        SELECT id, code_type, code_value, created_at, expires_at 
        FROM verification_codes 
        WHERE user_id = ? AND is_used = 0 
        ORDER BY id DESC
    ");
    $stmtCodes->execute([$u['id']]);
    $codes = $stmtCodes->fetchAll(PDO::FETCH_ASSOC);

    $formattedCodes = [];
    foreach ($codes as $c) {
        if ($c['code_type'] === 'email') {
            $c['verify_link'] = $final_base_url . "/verify-email?token=" . $c['code_value'];
        }
        $formattedCodes[] = $c;
    }

    $result[] = [
        'id' => (int)$u['id'],
        'first_name' => $u['first_name'],
        'last_name' => $u['last_name'],
        'email' => $u['email'],
        'mobile' => $u['mobile'],
        'is_email_verified' => (int)$u['is_email_verified'],
        'is_phone_verified' => (int)$u['is_phone_verified'],
        'created_at' => $u['created_at'],
        'codes' => $formattedCodes
    ];
}

jsonResponse(true, 'Pending verifications loaded.', [
    'users' => $result,
    'base_url' => $final_base_url
]);
?>
