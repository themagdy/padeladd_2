-- ============================================================
-- Phase 9: Stories System
-- ============================================================

-- Table: follows
-- Stores the social graph between players.
CREATE TABLE IF NOT EXISTS follows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    follower_id INT NOT NULL,
    following_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_follow (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table: stories
-- Stores the automated match-driven content.
CREATE TABLE IF NOT EXISTS stories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    type ENUM('upcoming', 'score') NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    venue_id INT NULL,
    scheduled_at DATETIME NULL,
    score_data_json JSON NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- Table: story_seen
-- Tracks read status for each user.
CREATE TABLE IF NOT EXISTS story_seen (
    story_id INT NOT NULL,
    user_id INT NOT NULL,
    seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (story_id, user_id),
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
