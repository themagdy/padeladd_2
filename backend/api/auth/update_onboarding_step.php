<?php
/**
 * POST /api/auth/update_onboarding_step
 * Updates the user's current onboarding step in the database.
 */
$pdo = getDB();
$user = getAuthenticatedUser($pdo);
$uid = (int)$user['id'];

$step = trim($data['step'] ?? '');
$allowedSteps = ['terms', 'profile', 'completed'];

if (!in_array($step, $allowedSteps, true)) {
    jsonResponse(false, 'Invalid onboarding step.');
}

$stmt = $pdo->prepare("UPDATE users SET onboarding_step = ? WHERE id = ?");
$stmt->execute([$step, $uid]);

jsonResponse(true, 'Onboarding step updated successfully.');
?>
