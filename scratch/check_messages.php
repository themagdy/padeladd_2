<?php
require_once __DIR__ . '/../backend/core/db.php';
$pdo = getDB();
$stmt = $pdo->query("SELECT * FROM in_app_messages ORDER BY id DESC LIMIT 5");
$messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($messages, JSON_PRETTY_PRINT);
