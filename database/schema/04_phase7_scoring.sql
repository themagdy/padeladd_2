-- ============================================================
-- Phase 7: Post-Match & Scoring
-- ============================================================

CREATE TABLE IF NOT EXISTS scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    submitted_by_user_id INT NOT NULL,
    t1_set1 INT DEFAULT 0,
    t2_set1 INT DEFAULT 0,
    t1_set2 INT DEFAULT 0,
    t2_set2 INT DEFAULT 0,
    t1_set3 INT DEFAULT 0,
    t2_set3 INT DEFAULT 0,
    status ENUM('pending', 'approved', 'disputed') DEFAULT 'pending',
    approved_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS disputes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    score_id INT NOT NULL,
    disputed_by_user_id INT NOT NULL,
    reason_text TEXT NOT NULL,
    status ENUM('open', 'resolved') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (score_id) REFERENCES scores(id) ON DELETE CASCADE,
    FOREIGN KEY (disputed_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    reported_by_user_id INT NOT NULL,
    target_user_id INT NULL,
    reason_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (reported_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
);
