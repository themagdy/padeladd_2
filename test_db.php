<?php
require_once __DIR__ . '/backend/core/db.php';
$pdo = getDB();
$stmt = $pdo->prepare("SELECT DISTINCT venue_name FROM matches WHERE venue_name LIKE ?");
$stmt->execute(['%cairo%']);
print_r($stmt->fetchAll(PDO::FETCH_COLUMN));
