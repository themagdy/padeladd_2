<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../backend/core/db.php';
require_once __DIR__ . '/../backend/helpers/auth_helper.php';

$pdo = getDB();
$uid = 1;

// Mock the environment
$data = ['mode' => 'mine_upcoming'];

try {
    echo "Testing Optimized Match List...\n";
    $start = microtime(true);
    
    // We can't easily include the file without causing jsonResponse to exit, 
    // so let's just simulate the core logic or manually observe the result.
    // Actually, I'll just check if the syntax is valid by including it and catching the output.
    
    ob_start();
    function jsonResponse($success, $message, $data) {
        echo json_encode(['success'=>$success, 'message'=>$message, 'data'=>$data]);
        exit;
    }
    
    include __DIR__ . '/../backend/api/match/list.php';
    $output = ob_get_clean();
    
    $end = microtime(true);
    $duration = ($end - $start) * 1000;
    
    echo "Execution time: " . round($duration, 2) . "ms\n";
    
    $res = json_decode($output, true);
    if ($res && $res['success']) {
        echo "Success! Found " . count($res['data']['matches']) . " matches.\n";
        if (count($res['data']['matches']) > 0) {
            $m = $res['data']['matches'][0];
            echo "Sample Match: " . $m['venue_name'] . " (" . count($m['slots']) . " slots)\n";
        }
    } else {
        echo "FAILED: " . ($res['message'] ?? 'Unknown error') . "\n";
        echo "Output: " . $output . "\n";
    }
    
} catch (Exception $e) {
    echo "CRITICAL ERROR: " . $e->getMessage() . "\n";
}
