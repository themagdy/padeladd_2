<?php
/**
 * GET /api/admin/matches/list
 * Admin-only: Paginated & searchable list of matches.
 */
require_once __DIR__ . '/../../../core/db.php';
require_once __DIR__ . '/../../../helpers/admin_auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

header('Content-Type: application/json');
validateAdmin();

$pdo = getDB();

$page = max(1, (int)($_GET['page'] ?? 1));
$limit = max(1, min(100, (int)($_GET['limit'] ?? 30)));
$offset = ($page - 1) * $limit;
$search = trim($_GET['q'] ?? $_GET['search'] ?? '');
$statusFilter = trim($_GET['status'] ?? 'all');

try {
    $whereClauses = [];
    $params = [];

    if ($statusFilter !== 'all' && $statusFilter !== '') {
        $whereClauses[] = "m.status = ?";
        $params[] = $statusFilter;
    }

    if ($search !== '') {
        $searchTerm = '%' . $search . '%';
        $cleanSearch = preg_replace('/^M-/i', '', $search);
        $cleanSearchTerm = '%' . $cleanSearch . '%';

        $whereClauses[] = "(
            m.match_code LIKE ?
            OR m.match_code LIKE ?
            OR v.name LIKE ?
            OR CONCAT(uc.first_name, ' ', uc.last_name) LIKE ?
            OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?
            OR upc.nickname LIKE ?
            OR up.nickname LIKE ?
            OR upc.player_code LIKE ?
            OR up.player_code LIKE ?
        )";
        $params[] = $searchTerm;
        $params[] = $cleanSearchTerm;
        for ($i = 0; $i < 7; $i++) {
            $params[] = $searchTerm;
        }
    }

    $whereSql = '';
    if (!empty($whereClauses)) {
        $whereSql = 'WHERE ' . implode(' AND ', $whereClauses);
    }

    // Count total distinct matching records
    $countSql = "
        SELECT COUNT(DISTINCT m.id)
        FROM matches m
        LEFT JOIN venues v ON m.venue_id = v.id
        LEFT JOIN users uc ON m.creator_id = uc.id
        LEFT JOIN user_profiles upc ON m.creator_id = upc.user_id
        LEFT JOIN match_players mp ON m.id = mp.match_id
        LEFT JOIN users u ON mp.user_id = u.id
        LEFT JOIN user_profiles up ON mp.user_id = up.user_id
        $whereSql
    ";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalMatches = (int)$countStmt->fetchColumn();

    // Fetch paginated matches
    $dataSql = "
        SELECT DISTINCT
               m.id, m.match_code, m.match_datetime, m.status, m.court_name, m.venue_id,
               m.match_type, m.gender_type, m.eligible_min, m.eligible_max, m.duration_minutes,
               COALESCE(v.name, 'Venue TBD') AS venue_name,
               v.venue_location_link,
               CONCAT(uc.first_name, ' ', uc.last_name) AS creator_name,
               upc.nickname AS creator_nickname,
               upc.player_code AS creator_code
        FROM matches m
        LEFT JOIN venues v ON m.venue_id = v.id
        LEFT JOIN users uc ON m.creator_id = uc.id
        LEFT JOIN user_profiles upc ON m.creator_id = upc.user_id
        LEFT JOIN match_players mp ON m.id = mp.match_id
        LEFT JOIN users u ON mp.user_id = u.id
        LEFT JOIN user_profiles up ON mp.user_id = up.user_id
        $whereSql
        ORDER BY m.id DESC, m.match_datetime DESC
        LIMIT $limit OFFSET $offset
    ";
    $dataStmt = $pdo->prepare($dataSql);
    $dataStmt->execute($params);
    $matches = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

    // Batch load players for each fetched match
    if (!empty($matches)) {
        $matchIds = array_column($matches, 'id');
        $inClause = implode(',', array_fill(0, count($matchIds), '?'));
        $playerStmt = $pdo->prepare("
            SELECT mp.match_id, mp.team_no, mp.slot_no, mp.playing_side, mp.status,
                   u.id AS user_id, u.first_name, u.last_name,
                   up.nickname, up.player_code, up.profile_image_thumb
            FROM match_players mp
            JOIN users u ON mp.user_id = u.id
            LEFT JOIN user_profiles up ON mp.user_id = up.user_id
            WHERE mp.match_id IN ($inClause) AND mp.status = 'confirmed'
            ORDER BY mp.team_no, mp.slot_no
        ");
        $playerStmt->execute($matchIds);
        $allPlayers = $playerStmt->fetchAll(PDO::FETCH_ASSOC);

        $playersByMatch = [];
        foreach ($allPlayers as $p) {
            $playersByMatch[$p['match_id']][] = $p;
        }

        foreach ($matches as &$m) {
            $m['id'] = (int)$m['id'];
            $m['players'] = $playersByMatch[$m['id']] ?? [];
        }
        unset($m);
    }

    $hasMore = ($offset + count($matches)) < $totalMatches;

    jsonResponse(true, 'Matches loaded.', [
        'matches'  => $matches,
        'total'    => $totalMatches,
        'page'     => $page,
        'limit'    => $limit,
        'has_more' => $hasMore
    ]);
} catch (Exception $e) {
    jsonResponse(false, $e->getMessage(), null, 500);
}
