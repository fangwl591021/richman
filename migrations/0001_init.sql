-- Richman D1 schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  picture_url TEXT NOT NULL DEFAULT '',
  status_message TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  county TEXT NOT NULL DEFAULT '',
  profile_complete INTEGER NOT NULL DEFAULT 0 CHECK (profile_complete IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  discount TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  line_contact TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '待核准' CHECK (status IN ('待核准', '啟用', '停用', '已刪除')),
  coupon_count INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  shop_id TEXT NOT NULL DEFAULT '',
  shop_name TEXT NOT NULL DEFAULT '',
  discount TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  line_contact TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'abandoned')),
  obtained_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  used_at TEXT,
  abandoned_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS cell_configs (
  cell_index INTEGER PRIMARY KEY,
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  cell_type TEXT NOT NULL DEFAULT '',
  shop_category TEXT NOT NULL DEFAULT '',
  special_event TEXT NOT NULL DEFAULT '',
  event_param TEXT NOT NULL DEFAULT '',
  cell_name TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS operation_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_user_id TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_shops_status_category ON shops(status, category);
CREATE INDEX IF NOT EXISTS idx_coupons_user_status ON coupons(user_id, status, obtained_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupons_shop ON coupons(shop_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_action_time ON operation_logs(action, created_at DESC);