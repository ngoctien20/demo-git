-- Daily cap for "Tạo trợ lý nhanh": one row per owner per day. No personal data (owner_id = Supabase user id).
CREATE TABLE IF NOT EXISTS setup_draft_usage (owner_id TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (owner_id, day));
