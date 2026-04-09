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
            $pdo = new PDO($dsn, "root", "root");
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $successDsn = $dsn;
            break;
        } catch (Exception $e) { }
    }

    if (!$pdo) { die("Could not connect to MAMP MySQL with any standard configuration."); }

    $setup = file_get_contents(__DIR__ . '/database/schema/00_setup.sql');
    $auth = file_get_contents(__DIR__ . '/database/schema/01_auth_tables.sql');

    $queries = array_merge(explode(';', $setup), explode(';', $auth));
    
    foreach($queries as $query) {
        $q = trim($query);
        if(!empty($q) && strpos($q, '--') !== 0) {
             $pdo->exec($q);
        }
    }

    echo "SUCCESS: Connected via $successDsn and seeded tables.";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage();
}
?>
