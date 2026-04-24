<?php
require_once __DIR__ . '/backend/core/db.php';
$pdo = getDB();
$stmt = $pdo->query('SHOW TABLES');
while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
    echo $row[0] . "
";
}

