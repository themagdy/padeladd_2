<?php
require_once __DIR__ . '/../backend/core/db.php';
$pdo = getDB();
$stmt = $pdo->query("SELECT * FROM in_app_message_views");
$views = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($views, JSON_PRETTY_PRINT);
