<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo); // Validates Bearer token

// Delete the current session token
$token = getBearerToken();
$stmt = $pdo->prepare("DELETE FROM user_sessions WHERE token = ?");
$stmt->execute([$token]);

jsonResponse(true, 'Logged out successfully');
?>
