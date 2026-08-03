<?php
require_once __DIR__ . '/../core/db.php';
try {
    $pdo = getDB();
    $q = $pdo->query("SELECT id, status, match_code, created_with_partner, match_datetime FROM matches ORDER BY id DESC LIMIT 5");
    echo json_encode(['success' => true, 'matches' => $q->fetchAll(PDO::FETCH_ASSOC)]);
} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
