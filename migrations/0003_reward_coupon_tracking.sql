-- Track coupon source and reward landing analytics.
ALTER TABLE coupons ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE coupons ADD COLUMN source_cell_index INTEGER;
ALTER TABLE coupons ADD COLUMN source_cell_name TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_coupons_source_status ON coupons(source, status, obtained_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_reward_time ON operation_logs(action, created_at DESC);
