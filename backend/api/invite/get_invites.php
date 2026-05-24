<?php
/**
 * POST /api/invite/get_invites
 * Authenticated endpoint to fetch the player's 3 invite codes and their referral redemptions.
 * Dynamically seeds exactly 3 codes on-the-fly to ensure seamless backward compatibility.
 */
require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../helpers/auth_helper.php';
require_once __DIR__ . '/../../helpers/response.php';

$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = $user['id'];

// Get invite-only mode setting
$modeStmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'invite_only_mode'");
$modeStmt->execute();
$modeVal = $modeStmt->fetchColumn();
$invite_only_mode = ($modeVal === '1');

// 1. Count how many invites the player has generated
$countStmt = $pdo->prepare("SELECT COUNT(*) FROM invite_keys WHERE created_by_user_id = ?");
$countStmt->execute([$uid]);
$currentCount = (int)$countStmt->fetchColumn();

// 2. Dynamically seed up to 3 invites if they don't have them yet
if ($currentCount < 3) {
    $needed = 3 - $currentCount;
    $pdo->beginTransaction();
    try {
        for ($i = 0; $i < $needed; $i++) {
            // Generate a secure, unique 6-character random hex code
            $code = 'PADEL-' . strtoupper(bin2hex(random_bytes(3)));
            
            // Safety loop to ensure uniqueness
            $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM invite_keys WHERE code = ?");
            $checkStmt->execute([$code]);
            while ((int)$checkStmt->fetchColumn() > 0) {
                $code = 'PADEL-' . strtoupper(bin2hex(random_bytes(3)));
                $checkStmt->execute([$code]);
            }
            
            $insertStmt = $pdo->prepare("INSERT INTO invite_keys (code, created_by_user_id) VALUES (?, ?)");
            $insertStmt->execute([$code, $uid]);
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(false, 'Failed to dynamically generate invitation codes.', null, 500);
    }
}

// 3. Fetch the full list of codes and their redemption details
$listStmt = $pdo->prepare("
    SELECT ik.code, ik.used_at, u.first_name, u.last_name,
           up.nickname AS used_by_nickname, up.profile_image_thumb AS used_by_avatar, up.player_code AS used_by_code
    FROM invite_keys ik
    LEFT JOIN users u ON ik.used_by_user_id = u.id
    LEFT JOIN user_profiles up ON ik.used_by_user_id = up.user_id
    WHERE ik.created_by_user_id = ?
    ORDER BY ik.id ASC
");
$listStmt->execute([$uid]);
$invites = $listStmt->fetchAll(PDO::FETCH_ASSOC);

// Map referred names and counts
$invites_left = 0;
$formattedInvites = [];

foreach ($invites as $invite) {
    $isUsed = !empty($invite['used_at']);
    if (!$isUsed) {
        $invites_left++;
    }
    
    // Resolve nickname or first name
    $usedByName = null;
    if ($isUsed) {
        if (!empty($invite['used_by_nickname'])) {
            $usedByName = $invite['used_by_nickname'];
        } else {
            $usedByName = trim($invite['first_name'] . ' ' . substr($invite['last_name'], 0, 1) . '.');
        }
    }
    
    $formattedInvites[] = [
        'code' => $invite['code'],
        'used_at' => $invite['used_at'],
        'used_by_name' => $usedByName,
        'used_by_avatar' => $invite['used_by_avatar'],
        'used_by_code' => $invite['used_by_code']
    ];
}

jsonResponse(true, 'Invites retrieved successfully.', [
    'invite_only_mode' => $invite_only_mode,
    'keys' => $formattedInvites,
    'invites_left' => $invites_left
]);
