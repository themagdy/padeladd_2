<?php
require_once __DIR__ . '/backend/core/db.php';
$pdo = getDB();

// Get the latest user who has unverified codes
$stmt = $pdo->query("
    SELECT u.id, u.email, u.mobile 
    FROM users u 
    JOIN verification_codes v ON u.id = v.user_id 
    WHERE v.is_used = 0 
    ORDER BY v.id DESC 
    LIMIT 1
");
$user = $stmt->fetch();

echo "<html><head><title>Padeladd Dev Tool</title><style>body{font-family:sans-serif; padding:40px; background:#1e293b; color:white;} .box{background:#334155; padding:20px; border-radius:12px; margin-bottom:20px;} a{color:#38bdf8;}</style></head><body>";
echo "<h1>Local Verification Cheat Sheet</h1>";

if ($user) {
    echo "<div class='box'>";
    echo "<h3>Testing User: " . htmlspecialchars($user['email']) . "</h3>";
    
    // Get codes
    $stmtCodes = $pdo->prepare("SELECT code_type, code_value FROM verification_codes WHERE user_id = ? AND is_used = 0");
    $stmtCodes->execute([$user['id']]);
    $codes = $stmtCodes->fetchAll();
    
    foreach ($codes as $c) {
        if ($c['code_type'] === 'email') {
            $link = "http://localhost:8888/padeladd4/verify-email?token=" . $c['code_value'];
            echo "<p><b>Email Link:</b> <a href='$link' target='_blank'>$link</a></p>";
        } else {
            echo "<p><b>WhatsApp OTP:</b> <span style='font-size:24px; color:#4ade80; font-weight:bold;'>" . $c['code_value'] . "</span></p>";
        }
    }
    echo "</div>";
} else {
    echo "<p>No active unverified codes found in local database.</p>";
}

echo "<button onclick='location.reload()'>Refresh</button>";
echo "</body></html>";
