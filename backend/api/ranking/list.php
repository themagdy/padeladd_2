<?php
/**
 * ranking/list.php
 * Fetches the leaderboard sorted by points.
 */

$pdo = getDB();
// Optional: we can require auth if we want, but rankings might be public.
// For now, let's keep it consistent with other private endpoints.
$user = getAuthenticatedUser($pdo);

$gender = $data['gender'] ?? 'male';
$limit = intval($data['limit'] ?? 10); // Default to top 10 for dashboard performance

// Fetch top players joining with users and profiles for display data
$stmt = $pdo->prepare("
    SELECT 
        u.id as user_id,
        u.first_name,
        u.last_name,
        up.nickname,
        up.profile_image,
        up.player_code,
        up.date_of_birth,
        ps.points,
        ps.points_this_week,
        ps.matches_played,
        ps.win_rate
    FROM player_stats ps
    JOIN users u ON ps.user_id = u.id
    JOIN user_profiles up ON ps.user_id = up.user_id
    WHERE up.gender = ?
    ORDER BY ps.points DESC, ps.matches_played DESC
    LIMIT ?
");

$stmt->execute([$gender, $limit]);
$ranking = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Formatting for frontend
$currentRank = 1;
$previousPoints = null;

foreach ($ranking as $index => &$row) {
    if ($previousPoints !== null && $row['points'] < $previousPoints) {
        $currentRank = $index + 1;
    }
    $row['rank'] = $currentRank;
    $previousPoints = $row['points'];

    // Calculate age
    $row['age'] = null;
    if (!empty($row['date_of_birth'])) {
        $birthDate = new DateTime($row['date_of_birth']);
        $today = new DateTime();
        $row['age'] = $today->diff($birthDate)->y;
    }

    // Ensure numeric types
    $row['points'] = (int)$row['points'];
    $row['points_this_week'] = (int)$row['points_this_week'];
    $row['matches_played'] = (int)$row['matches_played'];
    $row['win_rate'] = (int)$row['win_rate'];
    
    // Fallback nickname
    if (empty($row['nickname'])) {
        $row['nickname'] = $row['first_name'];
    }
}

jsonResponse(true, 'Ranking loaded.', [
    'ranking' => $ranking,
    'current_tab' => $gender
]);
