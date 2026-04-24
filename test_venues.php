<?php
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['REQUEST_URI'] = '/padeladd4/backend/api/match/venues';
$_SERVER['SCRIPT_NAME'] = '/padeladd4/backend/api/index.php';
$input = '{"q":"cairo"}';
file_put_contents("php://input", $input);
require_once __DIR__ . '/backend/api/index.php';
