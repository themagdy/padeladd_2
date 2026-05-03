<?php
require_once __DIR__ . '/backend/core/db.php';
$pdo = getDB();
$stmt = $pdo->prepare("
    SELECT DISTINCT v.name 
    FROM matches m 
    JOIN venues v ON m.venue_id = v.id 
    WHERE v.name LIKE ?
");
$stmt->execute(['%cairo%']);
print_r($stmt->fetchAll(PDO::FETCH_COLUMN));
