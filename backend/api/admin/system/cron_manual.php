<?php
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Method not allowed.', null, 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$task = $input['task'] ?? '';

if (empty($task)) {
    jsonResponse(false, 'Task name required.', null, 400);
}

// Map task names to script files
$scripts = [
    'auto_confirm' => 'cronjobs/auto_confirm_scores.php',
    'match_reminders' => 'cronjobs/match_reminders.php',
    'fix_stats'    => 'fix_missing_stats.php'
];

if (!isset($scripts[$task])) {
    jsonResponse(false, 'Invalid task.', null, 400);
}

$scriptPath = __DIR__ . '/../../../scripts/' . $scripts[$task];

if (!file_exists($scriptPath)) {
    jsonResponse(false, 'Script file not found.', null, 500);
}

// Execute the script and capture output
try {
    ob_start();
    include $scriptPath;
    $output = ob_get_clean();
    
    jsonResponse(true, 'Task executed successfully.', ['output' => $output]);
} catch (Exception $e) {
    ob_end_clean();
    jsonResponse(false, 'Execution error: ' . $e->getMessage(), null, 500);
}
