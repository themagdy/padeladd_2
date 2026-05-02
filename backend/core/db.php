<?php
require_once __DIR__ . '/config.php';

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
            $pdo->exec("SET time_zone = '+03:00'");
        } catch (\PDOException $e) {
            try {
                // MAMP fallback
                $dsn_mamp = "mysql:unix_socket=/Applications/MAMP/tmp/mysql/mysql.sock;dbname=" . DB_NAME . ";charset=utf8mb4";
                $pdo = new PDO($dsn_mamp, DB_USER, DB_PASS, $options);
                $pdo->exec("SET time_zone = '+03:00'");
            } catch (\PDOException $e2) {
                // Log technical error securely in backend
                error_log("DB Connection Error: " . $e2->getMessage());
                // Return JSON error matching defined API standards
                header('Content-Type: application/json');
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Database connection failed',
                    'data' => null
                ]);
                exit;
            }
        }
    }
    return $pdo;
}
?>
