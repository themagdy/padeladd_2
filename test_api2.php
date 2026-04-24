<?php
$_SERVER['REQUEST_URI'] = '/padeladd4/backend/api/chat/list';
$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['match_id'] = 4; // Use an existing match ID. Can check DB or use 1.
$_SERVER['SCRIPT_NAME'] = '/padeladd4/backend/api/index.php';
require 'backend/api/index.php';
