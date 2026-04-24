<?php
/**
 * POST /api/match/venues
 * Returns a list of distinct venue names matching the search query.
 */
$pdo  = getDB();
getAuthenticatedUser($pdo); // Ensure only logged-in users can query

$q = trim($data['q'] ?? '');

if (strlen($q) < 2) {
    // Return empty if query is too short
    jsonResponse(true, 'Query too short', ['venues' => []]);
}

try {
    // Split query into keywords
    $keywords = array_filter(explode(' ', $q));
    $where = [];
    $params = [];
    
    foreach ($keywords as $kw) {
        $where[] = "name LIKE ?";
        $params[] = '%' . $kw . '%';
    }

    if (empty($where)) {
        jsonResponse(true, 'Venues retrieved', ['venues' => []]);
    }

    $whereClause = implode(' AND ', $where);

    // Search for matching venue names
    $stmt = $pdo->prepare("
        SELECT name 
        FROM venues 
        WHERE $whereClause 
        ORDER BY name ASC 
        LIMIT 10
    ");
    $stmt->execute($params);
    $venues = $stmt->fetchAll(PDO::FETCH_COLUMN);

    jsonResponse(true, 'Venues retrieved', ['venues' => $venues]);

} catch (Exception $e) {
    jsonResponse(false, 'Database error: ' . $e->getMessage(), null, 500);
}
