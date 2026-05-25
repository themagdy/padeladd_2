<?php
/**
 * POST /api/admin/system/delete_promo
 * Admin authenticated endpoint.
 * - If the code has NEVER been used → hard DELETE it from the table.
 * - If the code HAS been used → soft-disable it (is_disabled = 1) to preserve the redemption history.
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

$pdo = getDB();

$data = json_decode(file_get_contents('php://input'), true);
$id   = isset($data['id']) ? (int)$data['id'] : 0;

if ($id <= 0) {
    jsonResponse(false, 'Invalid promo code ID.', null, 422);
}

// Only allow operating on admin-generated codes (created_by_user_id IS NULL)
$stmt = $pdo->prepare("SELECT id, used_by_user_id, is_disabled FROM invite_keys WHERE id = ? AND created_by_user_id IS NULL");
$stmt->execute([$id]);
$promo = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$promo) {
    jsonResponse(false, 'Promo code not found or not admin-generated.', null, 404);
}

if ($promo['used_by_user_id'] === null) {
    // Never used — safe to delete permanently
    $del = $pdo->prepare("DELETE FROM invite_keys WHERE id = ? AND created_by_user_id IS NULL");
    $del->execute([$id]);
    jsonResponse(true, 'Promo code deleted successfully.');
} else {
    // Already used — soft-disable to preserve audit trail
    if ((int)$promo['is_disabled'] === 1) {
        // Toggle back: re-enable
        $upd = $pdo->prepare("UPDATE invite_keys SET is_disabled = 0 WHERE id = ?");
        $upd->execute([$id]);
        jsonResponse(true, 'Promo code re-enabled.');
    } else {
        $upd = $pdo->prepare("UPDATE invite_keys SET is_disabled = 1 WHERE id = ?");
        $upd->execute([$id]);
        jsonResponse(true, 'Promo code disabled successfully.');
    }
}
