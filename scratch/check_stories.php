<?php
require_once __DIR__ . '/../backend/core/db.php';

$pdo = getDB();

$stmt = $pdo->query("
    SELECT 
        s.id as story_id,
        s.type as story_type,
        s.match_id,
        m.match_datetime,
        mp.user_id,
        u.first_name,
        up.nickname
    FROM stories s
    JOIN matches m ON s.match_id = m.id
    JOIN match_players mp ON s.match_id = mp.match_id
    JOIN users u ON mp.user_id = u.id
    JOIN user_profiles up ON u.id = up.user_id
    WHERE s.is_active = 1 AND s.expires_at > NOW()
");

$results = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($results, JSON_PRETTY_PRINT);
