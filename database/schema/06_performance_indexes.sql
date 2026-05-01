-- Speed Optimization: Database Indexes
-- Purpose: Drastically improve query performance for listing matches, rankings, and notifications.

-- 1. Matches table
CREATE INDEX idx_matches_status_date ON matches(status, match_datetime);
CREATE INDEX idx_matches_creator ON matches(creator_id);
CREATE INDEX idx_matches_code ON matches(match_code);

-- 2. Match Players table
CREATE INDEX idx_mp_match_id ON match_players(match_id);
CREATE INDEX idx_mp_user_id ON match_players(user_id);
CREATE INDEX idx_mp_status ON match_players(status);

-- 3. Player Stats table
CREATE INDEX idx_ps_user_points ON player_stats(user_id, points);
CREATE INDEX idx_ps_rank_points ON player_stats(rank_points DESC);

-- 4. Notifications table
CREATE INDEX idx_notif_user_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notif_created ON notifications(created_at DESC);

-- 5. Chat Messages table
CREATE INDEX idx_chat_match_date ON chat_messages(match_id, created_at);

-- 6. Waiting List table
CREATE INDEX idx_wl_match_status ON waiting_list(match_id, request_status);
