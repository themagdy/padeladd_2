<?php
/**
 * Waitlist Helper
 * Handles automated cleanup of waiting list entries when players join/leave matches.
 */

/**
 * Ensures that any player who is now confirmed in a match has their waitlist status updated.
 * 
 * @param PDO $pdo
 * @param int|null $match_id If provided, targets only a specific match.
 */
function cleanupWaitlist($pdo, $match_id = null) {
    try {
        // Find all active waiting list entries (pending or approved)
        $sql = "SELECT id, match_id, requester_id, partner_id FROM waiting_list WHERE request_status IN ('pending', 'approved')";
        $params = [];

        if ($match_id) {
            $sql .= " AND match_id = ?";
            $params[] = (int)$match_id;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($entries as $e) {
            // Check if requester is in the match as 'confirmed'
            $check = $pdo->prepare("SELECT id FROM match_players WHERE match_id = ? AND user_id = ? AND status = 'confirmed'");
            
            // Check requester
            $check->execute([$e['match_id'], $e['requester_id']]);
            $reqIn = $check->fetch();

            // Check partner (if exists)
            $parIn = false;
            if ($e['partner_id']) {
                $check->execute([$e['match_id'], $e['partner_id']]);
                $parIn = $check->fetch();
            }

            if ($reqIn || $parIn) {
                // Player is now confirmed in the match! Mark waitlist entry as 'joined'.
                $upd = $pdo->prepare("UPDATE waiting_list SET request_status = 'joined' WHERE id = ?");
                $upd->execute([$e['id']]);
            }
        }
        return true;
    } catch (Exception $e) {
        error_log("Waitlist Cleanup Helper Error: " . $e->getMessage());
        return false;
    }
}
