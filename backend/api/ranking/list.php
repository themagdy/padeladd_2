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
$limit  = intval($data['limit'] ?? 50);
$offset = intval($data['offset'] ?? 0);
$search = trim($data['search'] ?? '');

$searchWhere = '';
$rankSubquery = '';
if ($search !== '') {
    $searchWhere = " AND (u.first_name LIKE :s1 OR u.last_name LIKE :s2 OR up.nickname LIKE :s3 OR up.player_code LIKE :s4 OR CONCAT(u.first_name, ' ', u.last_name) LIKE :s5) ";
    $rankSubquery = ", (SELECT COUNT(*) + 1 
                        FROM player_stats ps2 JOIN users u2 ON ps2.user_id = u2.id JOIN user_profiles up2 ON ps2.user_id = up2.user_id 
                        WHERE up2.gender = up.gender AND u2.status = 'active'
                          AND (
                              (ps2.matches_played > 0) > (ps.matches_played > 0)
                              OR ((ps2.matches_played > 0) = (ps.matches_played > 0) AND ps2.rank_points > ps.rank_points)
                          )
                       ) as true_global_rank ";
}

$stmt = $pdo->prepare("
    SELECT 
        u.id as user_id,
        u.first_name,
        u.last_name,
        up.nickname,
        up.profile_image,
        up.profile_image_thumb,
        up.player_code,
        up.date_of_birth,
        ps.rank_points,
        (SELECT COALESCE(SUM(mp.point_change), 0) 
         FROM match_players mp 
         JOIN matches m ON mp.match_id = m.id 
         WHERE mp.user_id = u.id 
           AND m.status = 'completed'
           AND m.match_type = 'competition'
           AND m.match_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as points_this_week,
        ps.matches_played,
        ps.matches_won,
        ps.win_rate,
        (SELECT 1 FROM stories s 
         JOIN match_players mp_s ON s.match_id = mp_s.match_id 
         WHERE mp_s.user_id = u.id AND s.is_active = 1 AND s.expires_at > NOW() LIMIT 1) as has_active_story {$rankSubquery}
    FROM player_stats ps
    JOIN users u ON ps.user_id = u.id
    JOIN user_profiles up ON ps.user_id = up.user_id
    WHERE up.gender = :gender AND u.status = 'active' {$searchWhere}
    ORDER BY (ps.matches_played > 0) DESC, ps.rank_points DESC, LOWER(COALESCE(NULLIF(TRIM(up.nickname), ''), u.first_name)) ASC
    LIMIT :limit OFFSET :offset
");

$stmt->bindValue(':gender', $gender, PDO::PARAM_STR);
if ($search !== '') {
    $sVal = '%' . $search . '%';
    $stmt->bindValue(':s1', $sVal, PDO::PARAM_STR);
    $stmt->bindValue(':s2', $sVal, PDO::PARAM_STR);
    $stmt->bindValue(':s3', $sVal, PDO::PARAM_STR);
    $stmt->bindValue(':s4', $sVal, PDO::PARAM_STR);
    $stmt->bindValue(':s5', $sVal, PDO::PARAM_STR);
}
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$ranking = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Formatting for frontend
$currentRank    = $offset + 1;
$previousPoints = null;
$previousPlayed = null;

foreach ($ranking as $index => &$row) {
    if ($search !== '') {
        $row['rank'] = (int)$row['true_global_rank'];
    } else {
        $isPlayed = ($row['matches_played'] > 0);
        if ($previousPoints !== null && ($row['rank_points'] < $previousPoints || ($previousPlayed && !$isPlayed))) {
            $currentRank = $offset + $index + 1;
        }
        $row['rank']    = $currentRank;
        $previousPoints = $row['rank_points'];
        $previousPlayed = $isPlayed;
    }
    unset($row['true_global_rank']);

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
    $row['matches_won']      = (int)$row['matches_won'];
    $row['win_rate']         = (int)$row['win_rate'];
    $row['has_active_story'] = (bool)$row['has_active_story'];

    // Fallback nickname
    if (empty($row['nickname'])) {
        $row['nickname'] = $row['first_name'];
    }
}

// Append logged-in user if outside top 50 so UI pins card to top of general leaderboard
if ($user && $offset === 0 && empty($search) && !in_array((int)$user['id'], array_column($ranking, 'user_id'))) {
    $myStmt = $pdo->prepare("
        SELECT u.id as user_id, u.first_name, u.last_name, up.nickname, up.profile_image, up.profile_image_thumb, up.player_code, up.date_of_birth,
               ps.rank_points as points, ps.matches_played, ps.matches_won, ps.win_rate,
               (SELECT COALESCE(SUM(mp.point_change), 0) 
                FROM match_players mp JOIN matches m ON mp.match_id = m.id 
                WHERE mp.user_id = u.id AND m.status = 'completed' AND m.match_type = 'competition' AND m.match_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
               ) as points_this_week,
               (SELECT 1 FROM stories s JOIN match_players mp_s ON s.match_id = mp_s.match_id 
                WHERE mp_s.user_id = u.id AND s.is_active = 1 AND s.expires_at > NOW() LIMIT 1) as has_active_story
        FROM users u JOIN user_profiles up ON u.id = up.user_id JOIN player_stats ps ON u.id = ps.user_id
        WHERE u.id = ? AND up.gender = ? AND u.status = 'active'
    ");
    $myStmt->execute([(int)$user['id'], $gender]);
    if ($myRow = $myStmt->fetch(PDO::FETCH_ASSOC)) {
        $myPlayed = (int)($myRow['matches_played'] ?? 0);
        $myPts    = (int)($myRow['points'] ?? 0);
        $rStmt = $pdo->prepare("
            SELECT COUNT(*) + 1 
            FROM player_stats ps JOIN users u ON ps.user_id = u.id JOIN user_profiles up ON ps.user_id = up.user_id 
            WHERE up.gender = ? AND u.status = 'active'
              AND (
                  (ps.matches_played > 0) > (? > 0)
                  OR ((ps.matches_played > 0) = (? > 0) AND ps.rank_points > ?)
              )
        ");
        $rStmt->execute([$gender, $myPlayed, $myPlayed, $myPts]);
        $myRow['rank']             = (int)$rStmt->fetchColumn();
        $myRow['points']           = (int)$myRow['points'];
        $myRow['points_this_week'] = (int)$myRow['points_this_week'];
        $myRow['matches_played']   = (int)$myRow['matches_played'];
        $myRow['matches_won']      = (int)$myRow['matches_won'];
        $myRow['win_rate']         = (int)$myRow['win_rate'];
        $myRow['has_active_story'] = (bool)$myRow['has_active_story'];
        $myRow['nickname']         = !empty($myRow['nickname']) ? $myRow['nickname'] : $myRow['first_name'];
        $myRow['age']              = !empty($myRow['date_of_birth']) ? (new DateTime())->diff(new DateTime($myRow['date_of_birth']))->y : null;
        $ranking[] = $myRow;
    }
}

jsonResponse(true, 'Ranking loaded.', [
    'ranking'     => $ranking,
    'current_tab' => $gender
]);
