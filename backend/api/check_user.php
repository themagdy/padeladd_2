<?php
require_once __DIR__ . '/../core/db.php';
$pdo = getDB();
$stmt = $pdo->query("SELECT email, is_email_verified, is_phone_verified FROM users WHERE email = 'aworking@gmail.com'");
echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
?>
