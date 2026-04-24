<?php
require 'backend/api/index.php';
$pdo = getDB();
$stmt = $pdo->query("SELECT match_id, COUNT(*) as c FROM chat_messages GROUP BY match_id");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
