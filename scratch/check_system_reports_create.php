<?php
require_once __DIR__ . '/../backend/core/db.php';
$pdo = getDB();
try {
    $stmt = $pdo->query("SHOW CREATE TABLE system_reports");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo $row['Create Table'];
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
