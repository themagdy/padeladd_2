-- ============================================================
-- Phase 8: Competition Ranking System
-- ============================================================

-- Add rank_points column to player_stats
-- We keep 'points' for eligibility/level and 'rank_points' for the leaderboard merit.

ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS rank_points INT DEFAULT 50 COMMENT 'Competitive merit points';
ALTER TABLE player_stats MODIFY COLUMN points INT DEFAULT 100 COMMENT 'Level-based eligibility points';

-- Ensure all existing players start with at least 50 rank_points if not already set
UPDATE player_stats SET rank_points = 50 WHERE rank_points IS NULL;
