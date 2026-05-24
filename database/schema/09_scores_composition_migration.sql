-- ============================================================
-- Migration: Add structured columns and foreign keys for score compositions
-- ============================================================

-- 1. Add structured composition columns
ALTER TABLE scores 
ADD COLUMN t1_p1_user_id INT NULL AFTER t2_set3, 
ADD COLUMN t1_p2_user_id INT NULL AFTER t1_p1_user_id, 
ADD COLUMN t2_p1_user_id INT NULL AFTER t1_p2_user_id, 
ADD COLUMN t2_p2_user_id INT NULL AFTER t2_p1_user_id;

-- 2. Add foreign key constraints
ALTER TABLE scores 
ADD CONSTRAINT fk_scores_t1_p1 FOREIGN KEY (t1_p1_user_id) REFERENCES users(id) ON DELETE SET NULL, 
ADD CONSTRAINT fk_scores_t1_p2 FOREIGN KEY (t1_p2_user_id) REFERENCES users(id) ON DELETE SET NULL, 
ADD CONSTRAINT fk_scores_t2_p1 FOREIGN KEY (t2_p1_user_id) REFERENCES users(id) ON DELETE SET NULL, 
ADD CONSTRAINT fk_scores_t2_p2 FOREIGN KEY (t2_p2_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Drop legacy json column
ALTER TABLE scores DROP COLUMN composition_json;
