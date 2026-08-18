<?php
/**
 * GET/POST /api/profile/recent_partners
 * Returns the latest 3 distinct players the current user played with as partners.
 */
$pdo  = getDB();
$user = getAuthenticatedUser($pdo);
$uid  = $user['id'];

$sql = "
    SELECT 
        up.user_id,
        CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) AS name,
        up.nickname,
        up.player_code,
        up.profile_image,
        up.profile_image_thumb,
        up.playing_side,
        MAX(partner_sources.dt) AS last_played
    FROM (
        -- Approved partner invitations from waiting_list (both directions)
        SELECT 
            (CASE WHEN requester_id = :uid1 THEN partner_id ELSE requester_id END) AS partner_uid,
            created_at AS dt
        FROM waiting_list 
        WHERE (requester_id = :uid2 OR partner_id = :uid3) 
          AND partner_id IS NOT NULL 
          AND partner_id != 0 
          AND request_status IN ('approved', 'accepted')

        UNION ALL

        -- Confirmed team join / match creation partners from match_players
        SELECT 
            mp2.user_id AS partner_uid,
            m.match_datetime AS dt
        FROM match_players mp1
        JOIN match_players mp2 ON mp1.match_id = mp2.match_id AND mp1.team_no = mp2.team_no AND mp2.user_id != mp1.user_id
        JOIN matches m ON mp1.match_id = m.id
        WHERE mp1.user_id = :uid4 
          AND mp1.status = 'confirmed' AND mp2.status = 'confirmed'
          AND (mp1.join_type = 'team' OR mp2.join_type = 'team' OR m.created_with_partner = 1)
    ) partner_sources
    JOIN users u ON partner_sources.partner_uid = u.id
    JOIN user_profiles up ON partner_sources.partner_uid = up.user_id
    WHERE partner_sources.partner_uid != :uid5 AND up.user_id != " . ADMIN_SYSTEM_USER_ID . "
    GROUP BY up.user_id, u.first_name, u.last_name, up.nickname, up.player_code, up.profile_image, up.profile_image_thumb, up.playing_side
    ORDER BY last_played DESC
    LIMIT 3
";

$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':uid1' => $uid,
    ':uid2' => $uid,
    ':uid3' => $uid,
    ':uid4' => $uid,
    ':uid5' => $uid,
]);
$partners = $stmt->fetchAll(PDO::FETCH_ASSOC);

jsonResponse(true, 'Recent partners fetched.', [
    'partners' => $partners
]);

