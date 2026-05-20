<?php
$pdo = getDB();
$user = getAuthenticatedUser($pdo);

$stmt = $pdo->query("SELECT id, name FROM locations ORDER BY name ASC");
$locations = $stmt->fetchAll();

jsonResponse(true, 'Locations loaded.', $locations);
?>
