-- TIEN404 Đơn chắc tiền — D1 (SQLite) cho Worker tien404-don-chac-tien. CHƯA ÁP Ở ĐÂU CẢ (cần Tiến duyệt).
-- Mỗi shop một dòng: trạng thái JSON (đơn, kho, tài khoản nhận tiền) + version để ghi tranh chấp an toàn (so-sánh-rồi-ghi).
CREATE TABLE IF NOT EXISTS shops (
  store_id       TEXT PRIMARY KEY,               -- store_id do Zalo Hub cấp (vd zl-<sha>)
  connection_id  TEXT,                           -- kết nối Zalo Hub để gửi tin lại cho chủ
  owner_chat_id  TEXT,                           -- chat của chủ shop (chỉ chủ mới ra lệnh được)
  state          TEXT NOT NULL,                  -- JSON từ lib/engine.mjs
  version        INTEGER NOT NULL DEFAULT 0,
  has_open       INTEGER NOT NULL DEFAULT 0,     -- 1 = còn đơn chờ tiền/giữ hàng → cron mới phải xem
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS shops_open ON shops(has_open);

-- Đường nhận báo biến động số dư (SePay/Casso) của từng shop. Khoá chỉ lưu dạng băm SHA-256.
CREATE TABLE IF NOT EXISTS bank_links (
  id         TEXT PRIMARY KEY,                   -- 32 hex, nằm trong URL webhook
  store_id   TEXT NOT NULL REFERENCES shops(store_id),
  provider   TEXT NOT NULL CHECK (provider IN ('sepay','casso')),
  key_hash   TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_at    INTEGER
);
