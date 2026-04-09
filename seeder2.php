<?php
try {
    $dsns = [
        "mysql:unix_socket=/Applications/MAMP/tmp/mysql/mysql.sock",
        "mysql:host=localhost;port=8889",
        "mysql:host=127.0.0.1;port=8889",
        "mysql:host=localhost",
    ];
    $pdo = null;
    $successDsn = "";

    foreach ($dsns as $dsn) {
        try {
            $pdo = new PDO($dsn, "root", "root", [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            $successDsn = $dsn;
            break;
        } catch (Exception $e) { }
    }

    if (!$pdo) { die("Could not connect to MAMP MySQL with any standard configuration."); }

    $pdo->exec("CREATE DATABASE IF NOT EXISTS padeladd_phases DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE padeladd_phases");

    $auth = file_get_contents(__DIR__ . '/database/schema/01_auth_tables.sql');
    $queries = explode(';', $auth);
    foreach($queries as $query) {
        $q = trim($query);
        if(!empty($q) && strpos($q, '--') !== 0) {
             $pdo->exec($q);
        }
    }

    // Add a test user if not exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute(['test@test.com']);
    if (!$stmt->fetch()) {
        $hash = password_hash('password123', PASSWORD_BCRYPT);
        $pdo->prepare("INSERT INTO users (first_name, last_name, email, mobile, password_hash, is_email_verified, is_phone_verified) VALUES (?,?,?,?,?,1,1)")
            ->execute(['Test', 'User', 'test@test.com', '01012345678', $hash]);
    }

    echo trim("SUCCESS: Connected and Initialized. Test User: test@test.com / password123");
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage();
}
?>
