<?php
require_once __DIR__ . '/backend/core/db.php';
$pdo = getDB();

// SITE_URL is defined in config.php via db.php
// But we can make it smarter for local dev to match the browser
$current_host = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]";
// Get the directory path of the current script to build the base URL
$script_name = $_SERVER['SCRIPT_NAME'];
$base_dir = dirname($script_name);
if ($base_dir === '/') $base_dir = '';
$dynamic_base_url = $current_host . $base_dir;

// Use the dynamic one if SITE_URL is default localhost:8888 and we are on something else
$final_base_url = (defined('SITE_URL') && strpos(SITE_URL, 'localhost:8888') !== false && $_SERVER['HTTP_HOST'] !== 'localhost:8888') 
    ? $dynamic_base_url 
    : (defined('SITE_URL') ? SITE_URL : $dynamic_base_url);

// Get the latest users who have ANY unverified codes, or are themselves unverified
$stmt = $pdo->query("
    SELECT u.id, u.email, u.mobile, u.is_email_verified, u.is_phone_verified, u.first_name, u.last_name
    FROM users u 
    LEFT JOIN verification_codes v ON u.id = v.user_id 
    WHERE u.is_email_verified = 0 OR u.is_phone_verified = 0 OR (v.is_used = 0 AND v.id IS NOT NULL)
    GROUP BY u.id
    ORDER BY u.id DESC 
    LIMIT 3
");
$users = $stmt->fetchAll();

echo "<html><head><title>Padeladd Dev Tool</title><style>
    body{font-family:sans-serif; padding:40px; background:#0f172a; color:white; line-height:1.6;}
    .container{max-width:600px; margin:0 auto;}
    .box{background:#1e293b; padding:24px; border-radius:16px; margin-bottom:24px; border:1px solid #334155; box-shadow:0 10px 25px rgba(0,0,0,0.2);}
    h1{font-weight:800; letter-spacing:-1px; margin-bottom:30px; text-align:center; color:#38bdf8;}
    h3{margin-top:0; color:#f8fafc; display:flex; justify-content:space-between; align-items:center;}
    .badge{font-size:10px; padding:2px 8px; border-radius:4px; text-transform:uppercase; font-weight:700;}
    .badge-red{background:#ef4444; color:white;}
    .badge-green{background:#22c55e; color:white;}
    .link-box{background:#0f172a; padding:12px; border-radius:8px; border:1px solid #334155; word-break:break-all; margin:10px 0;}
    a{color:#38bdf8; text-decoration:none; font-weight:600;}
    a:hover{text-decoration:underline;}
    .otp{font-size:32px; color:#4ade80; font-weight:800; font-family:monospace; letter-spacing:4px;}
    button{background:#38bdf8; color:#0f172a; border:none; padding:12px 24px; border-radius:8px; font-weight:700; cursor:pointer; width:100%; font-size:16px; transition:all 0.2s;}
    button:hover{background:#7dd3fc; transform:translateY(-2px);}
    .user-meta{font-size:13px; color:#94a3b8; margin-bottom:15px;}
</style></head><body><div class='container'>";

echo "<h1>Verification Cheat Sheet</h1>";

if (empty($users)) {
    echo "<div class='box'><p style='text-align:center;'>No pending verifications found.</p></div>";
}

foreach ($users as $user) {
    echo "<div class='box'>";
    echo "<h3>" . htmlspecialchars($user['first_name'] . ' ' . $user['last_name']) . "</h3>";
    echo "<div class='user-meta'>" . htmlspecialchars($user['email']) . " • " . htmlspecialchars($user['mobile']) . "</div>";
    
    // Status
    echo "<div style='margin-bottom:20px; display:flex; gap:10px;'>";
    echo "<span class='badge " . ($user['is_email_verified'] ? 'badge-green' : 'badge-red') . "'>Email: " . ($user['is_email_verified'] ? 'Verified' : 'Pending') . "</span>";
    echo "<span class='badge " . ($user['is_phone_verified'] ? 'badge-green' : 'badge-red') . "'>Phone: " . ($user['is_phone_verified'] ? 'Verified' : 'Pending') . "</span>";
    echo "</div>";

    // Get codes
    $stmtCodes = $pdo->prepare("SELECT code_type, code_value FROM verification_codes WHERE user_id = ? AND is_used = 0 ORDER BY id DESC");
    $stmtCodes->execute([$user['id']]);
    $codes = $stmtCodes->fetchAll();
    
    if (empty($codes)) {
        echo "<p style='color:#94a3b8; font-style:italic;'>No active codes for this user.</p>";
    }

    foreach ($codes as $c) {
        if ($c['code_type'] === 'email') {
            $link = rtrim($final_base_url, '/') . "/verify-email?token=" . $c['code_value'];
            echo "<p><b>Email Verification Link:</b></p>";
            echo "<div class='link-box'><a href='$link' target='_blank'>$link</a></div>";
        } else {
            echo "<p><b>WhatsApp OTP:</b></p>";
            echo "<div class='otp'>" . $c['code_value'] . "</div>";
        }
    }
    echo "</div>";
}

echo "<button onclick='location.reload()'>Refresh List</button>";
echo "</div></body></html>";

