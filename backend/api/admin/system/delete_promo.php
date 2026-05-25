<?php
/**
 * POST /api/admin/system/delete_promo
 * Admin authenticated endpoint.
 * - action = 'delete' : Hard DELETE the code from the table (only allowed if never used).
 * - action = 'toggle' : Toggle soft-disabled state (is_disabled = 1 or 0).
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

$pdo = getDB();

$data = json_decode(file_get_contents('php://input'), true);
$id   = isset($data['id']) ? (int)$data['id'] : 0;
$action = isset($data['action']) ? trim($data['action']) : 'delete';

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

if ($action === 'delete') {
    if ($promo['used_by_user_id'] !== null) {
        jsonResponse(false, 'Redeemed promo codes cannot be deleted. Disable them instead.', null, 400);
    }
    $del = $pdo->prepare("DELETE FROM invite_keys WHERE id = ? AND created_by_user_id IS NULL");
    $del->execute([$id]);
    jsonResponse(true, 'Promo code deleted successfully.');
} else {
    // Toggle: disable or enable
    $newStatus = (int)$promo['is_disabled'] === 1 ? 0 : 1;
    $upd = $pdo->prepare("UPDATE invite_keys SET is_disabled = ? WHERE id = ?");
    $upd->execute([$newStatus, $id]);
    $msg = $newStatus === 1 ? 'Promo code disabled successfully.' : 'Promo code enabled successfully.';
    jsonResponse(true, $msg);
}
