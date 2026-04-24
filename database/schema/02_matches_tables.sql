-- ============================================================
-- Phase 3: Match System Tables
-- ============================================================

-- Matches: one row per match, created by one player (solo or with a chosen partner)
CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    creator_id INT NOT NULL,
    venue_name VARCHAR(255) NOT NULL,
    court_name VARCHAR(100) NULL,
    match_datetime DATETIME NOT NULL,
    created_with_partner TINYINT(1) DEFAULT 0 COMMENT '1 if creator brought a partner at creation',
    status ENUM('open', 'full', 'completed', 'cancelled') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Match Players: 4 slots per match — team 1 slots 1&2, team 2 slots 1&2
CREATE TABLE IF NOT EXISTS match_players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    user_id INT NOT NULL,
    team_no TINYINT(1) NOT NULL COMMENT '1 or 2',
    slot_no TINYINT(1) NOT NULL COMMENT '1 or 2 within the team',
    join_type ENUM('creator', 'solo', 'team') NOT NULL DEFAULT 'solo',
    status ENUM('confirmed', 'pending') DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_match_slot (match_id, team_no, slot_no),
    UNIQUE KEY uq_match_user (match_id, user_id),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE
);

-- Waiting list: team join requests pending partner approval
CREATE TABLE IF NOT EXISTS waiting_list (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    requester_id INT NOT NULL,
    partner_id INT NOT NULL,
    request_status ENUM('pending', 'approved', 'denied', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id)     REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_id) REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (partner_id)   REFERENCES users(id)   ON DELETE CASCADE
);

-- Blocked partner requests: tracks how many times a requester has been blocked
CREATE TABLE IF NOT EXISTS blocked_partner_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    blocker_user_id INT NOT NULL,
    blocked_user_id INT NOT NULL,
    block_count INT DEFAULT 1,
    blocked_until DATETIME NULL COMMENT 'After 3 blocks the user is locked out for 1 month',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_block_pair (blocker_user_id, blocked_user_id),
    FOREIGN KEY (blocker_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Player stats: pre-wired for Phase 7 scoring (one row per user, created on profile completion)
CREATE TABLE IF NOT EXISTS player_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    points INT DEFAULT 50,
    matches_played INT DEFAULT 0,
    matches_won INT DEFAULT 0,
    matches_lost INT DEFAULT 0,
    win_rate INT DEFAULT 0 COMMENT 'Integer 0-100, updated after each match',
    streak INT DEFAULT 0 COMMENT 'Positive = win streak, negative = loss streak',
    ranking INT NULL,
    highest_ranking INT NULL,
    points_this_week INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
