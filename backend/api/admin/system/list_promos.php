<?php
/**
 * POST /api/admin/system/list_promos
 * Admin authenticated endpoint to list all system-wide campaign codes and their redemption logs.
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

$pdo = getDB();

$stmt = $pdo->prepare("
    SELECT ik.id, ik.code, ik.created_at, ik.used_at,
           u.first_name, u.last_name, up.nickname AS used_by_nickname, up.player_code AS used_by_code
    FROM invite_keys ik
    LEFT JOIN users u ON ik.used_by_user_id = u.id
    LEFT JOIN user_profiles up ON ik.used_by_user_id = up.user_id
    WHERE ik.created_by_user_id IS NULL
    ORDER BY ik.id DESC
");
$stmt->execute();
$promos = $stmt->fetchAll(PDO::FETCH_ASSOC);

$formatted = [];
foreach ($promos as $p) {
    $usedByName = null;
    if (!empty($p['used_at'])) {
        if (!empty($p['used_by_nickname'])) {
            $usedByName = $p['used_by_nickname'];
        } else {
            $usedByName = trim($p['first_name'] . ' ' . substr($p['last_name'], 0, 1) . '.');
        }
    }
    
    $formatted[] = [
        'id' => $p['id'],
        'code' => $p['code'],
        'created_at' => $p['created_at'],
        'used_at' => $p['used_at'],
        'used_by_name' => $usedByName,
        'used_by_code' => $p['used_by_code']
    ];
}

jsonResponse(true, 'Promo codes list fetched successfully.', $formatted);
// ...
