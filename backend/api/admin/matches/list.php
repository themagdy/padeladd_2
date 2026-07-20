<?php
/**
 * GET /api/admin/matches/list
 * Admin-only: List all upcoming and active matches.
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

try {
    // Fetch all open/full/on_hold matches
    $stmt = $pdo->query("
        SELECT m.id, m.match_code, m.match_datetime, m.status, m.court_name, m.venue_id,
               v.name AS venue_name,
               CONCAT(u.first_name, ' ', u.last_name) as creator_name,
               up.nickname as creator_nickname,
               up.player_code as creator_code
        FROM matches m
        JOIN users u ON m.creator_id = u.id
        LEFT JOIN user_profiles up ON m.creator_id = up.user_id
        LEFT JOIN venues v ON m.venue_id = v.id
        ORDER BY m.match_datetime DESC
    ");
    $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, 'Matches loaded.', ['matches' => $matches]);
} catch (Exception $e) {
    jsonResponse(false, $e->getMessage(), null, 500);
}
