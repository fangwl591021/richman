-- Richman product catalog tables
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  category_id TEXT,
  sku TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TWD',
  stock_qty INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive', 'sold_out', 'deleted')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_product_categories_shop_status ON product_categories(shop_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_shop_status ON products(shop_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category_status ON products(category_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);