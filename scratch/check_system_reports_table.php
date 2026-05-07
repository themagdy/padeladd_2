<?php
require_once __DIR__ . '/../backend/core/db.php';
$pdo = getDB();
try {
    $stmt = $pdo->query("DESCRIBE system_reports");
    $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($cols, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
