<?php
/**
 * POST /api/profile/delete
 * Soft-deletes and anonymizes the authenticated user's account.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = (int)$user['id'];

// Get current session token
$token = getBearerToken();

try {
    $pdo->beginTransaction();

    // 1. Release unique constraints on invite keys
    $stmtInv1 = $pdo->prepare("UPDATE invite_keys SET created_by_user_id = NULL WHERE created_by_user_id = ?");
    $stmtInv1->execute([$uid]);

    $stmtInv2 = $pdo->prepare("UPDATE invite_keys SET used_by_user_id = NULL WHERE used_by_user_id = ?");
    $stmtInv2->execute([$uid]);

    // 2. Clear social follows
    $stmtFollow = $pdo->prepare("DELETE FROM follows WHERE follower_id = ? OR following_id = ?");
    $stmtFollow->execute([$uid, $uid]);

    // 3. Clear push device tokens and verification codes
    $stmtToken = $pdo->prepare("DELETE FROM user_device_tokens WHERE user_id = ?");
    $stmtToken->execute([$uid]);

    $stmtCodes = $pdo->prepare("DELETE FROM verification_codes WHERE user_id = ?");
    $stmtCodes->execute([$uid]);

    // 4. release unique constraints on email and mobile by prepending timestamp
    $timestamp = time();
    $newEmail = '#' . $timestamp . '_' . $user['email'];
    $newMobile = '#' . $timestamp . '_' . $user['mobile'];

    // Update primary user table (status to deleted, scramble email/phone, clear name & auth_token)
    $stmtUser = $pdo->prepare("
        UPDATE users 
        SET first_name = 'Deleted', 
            last_name = 'Player', 
            email = ?, 
            mobile = ?, 
            status = 'deleted', 
            auth_token = NULL 
        WHERE id = ?
    ");
    $stmtUser->execute([$newEmail, $newMobile, $uid]);

    // 5. Clear profile details
    $stmtProf = $pdo->prepare("
        UPDATE user_profiles 
        SET nickname = 'Deleted Player', 
            bio = NULL, 
            date_of_birth = NULL, 
            profile_image = NULL, 
            profile_image_thumb = NULL 
        WHERE user_id = ?
    ");
    $stmtProf->execute([$uid]);

    // 6. Delete active sessions
    $stmtSession = $pdo->prepare("DELETE FROM user_sessions WHERE user_id = ?");
    $stmtSession->execute([$uid]);

    $pdo->commit();

    jsonResponse(true, 'Account successfully deleted.');
} catch (\Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}
?>
