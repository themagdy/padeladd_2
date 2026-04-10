<?php
require_once __DIR__ . '/backend/core/db.php';
$pdo = getDB();

// Get the latest registered user
$stmt = $pdo->query("SELECT id, email, first_name, created_at FROM users ORDER BY id DESC LIMIT 1");
$user = $stmt->fetch();

echo "<h1>Last Registration Debug</h1>";

if (!$user) {
    echo "No users found in database.";
} else {
    echo "<b>User:</b> " . htmlspecialchars($user['first_name']) . " (" . htmlspecialchars($user['email']) . ")<br>";
    echo "<b>Registered at:</b> " . $user['created_at'] . "<br><br>";

    // Get their verification codes
    $stmtCodes = $pdo->prepare("SELECT code_type, code_value FROM verification_codes WHERE user_id = ?");
    $stmtCodes->execute([$user['id']]);
    $codes = $stmtCodes->fetchAll();

    foreach ($codes as $c) {
        if ($c['code_type'] === 'email') {
            $link = "https://ahmedmagdy.com/pl/verify-email?token=" . $c['code_value'];
            echo "📫 <b>Email Verification Link:</b> <a href='$link'>$link</a><br>";
        } else {
            echo "📱 <b>SMS/OTP Code:</b> <span style='font-size: 20px; font-weight: bold; color: #f7941d;'>" . $c['code_value'] . "</span><br>";
        }
    }
}

echo "<hr><p style='color: grey; font-size: 12px;'>Note: Delete this file once testing is finished for security.</p>";
?>
