<?php
/**
 * POST /api/admin/system/generate_promo
 * Admin authenticated endpoint to manually create custom or random marketing promo codes.
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

$pdo = getDB();

$code = trim($data['code'] ?? '');

if (!empty($code)) {
    // Sanitize: allow only alphanumeric characters, underscores, and dashes
    $code = strtoupper(preg_replace('/[^A-Za-z0-9\-_]/', '', $code));
    
    if (strlen($code) < 3 || strlen($code) > 20) {
        jsonResponse(false, 'Promo code must be between 3 and 20 characters.', null, 422);
    }
} else {
    // Generate a random high-entropy promo key
    $code = 'PROMO-' . strtoupper(bin2hex(random_bytes(3)));
}

// Check if the code already exists
$checkStmt = $pdo->prepare("SELECT COUNT(*) FROM invite_keys WHERE code = ?");
$checkStmt->execute([$code]);
if ((int)$checkStmt->fetchColumn() > 0) {
    jsonResponse(false, 'Invitation or promo code already exists. Please choose a unique value.', null, 409);
}

$insertStmt = $pdo->prepare("INSERT INTO invite_keys (code, created_by_user_id) VALUES (?, NULL)");
$insertStmt->execute([$code]);

jsonResponse(true, 'Promo code created successfully.', [
    'code' => $code
]);
