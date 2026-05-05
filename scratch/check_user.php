<?php
require_once __DIR__ . '/../backend/core/db.php';

$pdo = getDB();
$mobile = '01279411665';

$stmt = $pdo->prepare("SELECT id, email, mobile, is_email_verified, is_phone_verified FROM users WHERE mobile = ?");
$stmt->execute([$mobile]);
$results = $stmt->fetchAll();

header('Content-Type: application/json');
echo json_encode($results, JSON_PRETTY_PRINT);
?>
