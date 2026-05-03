<?php
$_SERVER['REQUEST_METHOD'] = 'POST';
$input = '{"q":"cairo"}';
file_put_contents("php://input", $input);
require_once __DIR__ . '/backend/core/db.php';
require_once __DIR__ . '/backend/helpers/response.php';
$pdo = getDB();
$data = json_decode($input, true);
$q = $data['q'];
$stmt = $pdo->prepare("
    SELECT DISTINCT v.name 
    FROM matches m 
    JOIN venues v ON m.venue_id = v.id 
    WHERE v.name LIKE ? 
    ORDER BY v.name ASC 
    LIMIT 10
");
$stmt->execute(['%' . $q . '%']);
$venues = $stmt->fetchAll(PDO::FETCH_COLUMN);
jsonResponse(true, 'Venues retrieved', ['venues' => $venues]);
