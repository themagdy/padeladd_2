<?php
require_once __DIR__ . '/../core/db.php';
$pdo = getDB();
$res = $pdo->query("DESCRIBE matches")->fetchAll(PDO::FETCH_ASSOC);
file_put_contents(__DIR__ . '/../../matches_cols.txt', print_r($res, true));
echo "Check complete.";
