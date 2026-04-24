<?php
/**
 * notification_helper.php
 * Phase 6: Central helper for creating notifications.
 *
 * Usage:
 *   createNotification($pdo, $user_id, 'match_joined', $match_id, "{$name} joined your match");
 */

function createNotification(PDO $pdo, int $user_id, string $type, ?int $reference_id, string $message_text, ?int $sender_id = null): void {
    try {
        $stmt = $pdo->prepare("INSERT INTO notifications (user_id, type, reference_id, sender_id, message_text) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$user_id, $type, $reference_id, $sender_id, $message_text]);
    } catch (Exception $e) {
        error_log("createNotification failed: " . $e->getMessage());
    }
}

/**
 * Delete a notification for a user.
 * Used when a request is cancelled.
 */
function deleteNotification(PDO $pdo, int $user_id, string $type, int $reference_id): void {
    try {
        $stmt = $pdo->prepare("DELETE FROM notifications WHERE user_id = ? AND type = ? AND reference_id = ?");
        $stmt->execute([$user_id, $type, $reference_id]);
    } catch (Exception $e) {
        error_log("deleteNotification failed: " . $e->getMessage());
    }
}

/**
 * Broadcast a notification to all players currently occupying slots in a match.
 */
function notifyMatchParticipants(PDO $pdo, int $match_id, string $type, string $message, ?int $sender_id = null, array $exclude_ids = []): void {
    try {
        $stmt = $pdo->prepare("SELECT user_id FROM match_players WHERE match_id = ?");
        $stmt->execute([$match_id]);
        $players = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($players as $p) {
            $target_id = (int)$p['user_id'];
            if ($target_id === $sender_id || in_array($target_id, $exclude_ids)) continue;
            createNotification($pdo, $target_id, $type, $match_id, $message, $sender_id);
        }
    } catch (Exception $e) {
        error_log("notifyMatchParticipants failed: " . $e->getMessage());
    }
}

/**
 * Notify players on the waiting list when specific slot availability changes.
 * $availability_type: 'solo' or 'team'
 */
function notifyWaitlistAvailability(PDO $pdo, int $match_id, string $availability_type, ?int $sender_id = null): void {
    try {
        if ($availability_type === 'solo') {
            $msg = "A slot is now available in your match! Jump in now!";
            $sql = "SELECT requester_id FROM waiting_list WHERE match_id = ? AND partner_id IS NULL AND request_status = 'approved'";
        } else {
            $msg = "A full team spot is now available! Jump in with your partner now!";
            $sql = "SELECT requester_id, partner_id FROM waiting_list WHERE match_id = ? AND partner_id IS NOT NULL AND request_status = 'approved'";
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$match_id]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as $row) {
            // Notify requester
            createNotification($pdo, (int)$row['requester_id'], 'availability_alert', $match_id, $msg, $sender_id);
            // Notify partner if it's a team request
            if (!empty($row['partner_id'])) {
                createNotification($pdo, (int)$row['partner_id'], 'availability_alert', $match_id, $msg, $sender_id);
            }
        }
    } catch (Exception $e) {
        error_log("notifyWaitlistAvailability failed: " . $e->getMessage());
    }
}

/**
 * Get a user's display name from a pre-loaded user array or query it from DB.
 */
function getDisplayName(array $user): string {
    return !empty($user['nickname']) ? $user['nickname'] : trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
}
