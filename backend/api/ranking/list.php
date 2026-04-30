<?php
/**
 * ranking/list.php
 * Fetches the leaderboard sorted by rank_points (competition match points only).
 * rank_points starts at 0 for all players and only changes through competition matches.
 * player_stats.points is used for eligibility only and is NOT shown here.
 */

$pdo = getDB();
$user = getAuthenticatedUser($pdo);

$gender = $data['gender'] ?? 'male';
$limit  = intval($data['limit'] ?? 10);

$stmt = $pdo->prepare("
    SELECT 
        u.id as user_id,
        u.first_name,
        u.last_name,
        up.nickname,
        up.profile_image,
        up.player_code,
        up.date_of_birth,
        ps.rank_points,
        ps.points_this_week,
        ps.matches_played,
        ps.win_rate
    FROM player_stats ps
    JOIN users u ON ps.user_id = u.id
    JOIN user_profiles up ON ps.user_id = up.user_id
    WHERE up.gender = ? AND ps.matches_played > 0
    ORDER BY ps.rank_points DESC, ps.matches_played DESC
    LIMIT ?
");

$stmt->execute([$gender, $limit]);
$ranking = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Formatting for frontend
$currentRank    = 1;
$previousPoints = null;

foreach ($ranking as $index => &$row) {
    if ($previousPoints !== null && $row['rank_points'] < $previousPoints) {
        $currentRank = $index + 1;
    }
    $row['rank']        = $currentRank;
    $previousPoints     = $row['rank_points'];

    // Expose as 'points' to the frontend (no field rename needed in UI)
    $row['points'] = (int)$row['rank_points'];
    unset($row['rank_points']);

    // Calculate age
    $row['age'] = null;
    if (!empty($row['date_of_birth'])) {
        $birthDate = new DateTime($row['date_of_birth']);
        $today     = new DateTime();
        $row['age'] = $today->diff($birthDate)->y;
    }

    // Ensure numeric types
    $row['points_this_week'] = (int)$row['points_this_week'];
    $row['matches_played']   = (int)$row['matches_played'];
    $row['win_rate']         = (int)$row['win_rate'];

    // Fallback nickname
    if (empty($row['nickname'])) {
        $row['nickname'] = $row['first_name'];
    }
}

jsonResponse(true, 'Ranking loaded.', [
    'ranking'     => $ranking,
    'current_tab' => $gender
]);
