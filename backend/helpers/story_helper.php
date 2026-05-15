<?php
/**
 * StoryHelper
 * Manages the lifecycle of automated match stories.
 */
class StoryHelper {
    /**
     * Updates the 'upcoming' story for a match.
     * Triggered on join, leave, or match updates.
     */
    public static function updateMatchStory(PDO $pdo, int $matchId) {
        // 1. Get match info
        $stmt = $pdo->prepare("SELECT id, venue_id, match_datetime, status FROM matches WHERE id = ?");
        $stmt->execute([$matchId]);
        $match = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$match) return;

        // 2. Count confirmed players
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM match_players WHERE match_id = ? AND status = 'confirmed'");
        $stmt->execute([$matchId]);
        $count = (int)$stmt->fetchColumn();

        // Story is active only if match is full (4 players) and not completed/cancelled
        $isActive = ($count === 4 && ($match['status'] === 'open' || $match['status'] === 'full')) ? 1 : 0;

        // 3. Check if 'upcoming' story exists
        $stmt = $pdo->prepare("SELECT id FROM stories WHERE match_id = ? AND type = 'upcoming'");
        $stmt->execute([$matchId]);
        $storyId = $stmt->fetchColumn();

        if ($storyId) {
            // Update existing story
            $stmt = $pdo->prepare("UPDATE stories SET is_active = ?, venue_id = ?, scheduled_at = ?, expires_at = ? WHERE id = ?");
            $stmt->execute([$isActive, $match['venue_id'], $match['match_datetime'], $match['match_datetime'], $storyId]);
        } elseif ($isActive) {
            // Create new story
            $stmt = $pdo->prepare("INSERT INTO stories (match_id, type, is_active, venue_id, scheduled_at, expires_at) VALUES (?, 'upcoming', 1, ?, ?, ?)");
            $stmt->execute([$matchId, $match['venue_id'], $match['match_datetime'], $match['match_datetime']]);
        }
    }

    /**
     * Creates or updates a 'score' story for a match.
     * Triggered when a score is approved.
     */
    public static function createScoreStory(PDO $pdo, int $matchId) {
        // 1. Get match info
        $stmt = $pdo->prepare("SELECT id, venue_id FROM matches WHERE id = ?");
        $stmt->execute([$matchId]);
        $match = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$match) return;

        // 2. Get all approved scores for this match
        $stmt = $pdo->prepare("SELECT * FROM scores WHERE match_id = ? AND status = 'approved' ORDER BY created_at ASC");
        $stmt->execute([$matchId]);
        $scores = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (empty($scores)) return;

        // Score stories are valid for 48 hours after the last approval
        $expiresAt = date('Y-m-d H:i:s', time() + (48 * 3600));

        // 3. Check if 'score' story exists
        $stmt = $pdo->prepare("SELECT id FROM stories WHERE match_id = ? AND type = 'score'");
        $stmt->execute([$matchId]);
        $storyId = $stmt->fetchColumn();

        if ($storyId) {
            // Update existing score story (group multiple scores together)
            $stmt = $pdo->prepare("UPDATE stories SET is_active = 1, score_data_json = ?, expires_at = ? WHERE id = ?");
            $stmt->execute([json_encode($scores), $expiresAt, $storyId]);
        } else {
            // Create new score story
            $stmt = $pdo->prepare("INSERT INTO stories (match_id, type, is_active, venue_id, score_data_json, expires_at) VALUES (?, 'score', 1, ?, ?, ?)");
            $stmt->execute([$matchId, $match['venue_id'], json_encode($scores), $expiresAt]);
        }
        
        // 4. Deactivate the 'upcoming' story if it exists for this match
        $stmt = $pdo->prepare("UPDATE stories SET is_active = 0 WHERE match_id = ? AND type = 'upcoming'");
        $stmt->execute([$matchId]);
    }
}
