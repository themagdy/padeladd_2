-- ============================================================
-- Phase 4: Match Actions & Rules
-- ============================================================

-- Audit log for all match lifecycle events
CREATE TABLE IF NOT EXISTS match_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    user_id INT NULL COMMENT 'The user who triggered the event, NULL for system events',
    event_type ENUM(
        'player_withdrawn',
        'team_withdrawn',
        'match_cancelled',
        'late_withdrawal',
        'late_cancellation'
    ) NOT NULL,
    event_data JSON NULL COMMENT 'e.g. { hours_until_match: 3.5, affected_user_ids: [5, 12] }',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Add cancellation tracking columns to matches (run only once)
ALTER TABLE matches
    ADD COLUMN cancelled_at DATETIME NULL,
    ADD COLUMN cancellation_reason VARCHAR(255) NULL;
