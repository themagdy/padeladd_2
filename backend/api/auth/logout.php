<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo); // Validates Bearer token

// Nullify token
$stmt = $pdo->prepare("UPDATE users SET auth_token = NULL WHERE id = ?");
$stmt->execute([$user['id']]);

jsonResponse(true, 'Logged out successfully');
?>
