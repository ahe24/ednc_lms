-- Quick migration for production server
-- Run with: sqlite3 database/licenses.db < quick-migration.sql

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_id INTEGER NOT NULL,
    part_number TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    earliest_expiry_date DATE,
    latest_expiry_date DATE,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (license_id) REFERENCES licenses(id)
);

-- Add product_id column to license_features (ignore error if exists)
ALTER TABLE license_features ADD COLUMN product_id INTEGER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_license_expiry 
    ON products(license_id, earliest_expiry_date);
CREATE INDEX IF NOT EXISTS idx_features_product_expiry 
    ON license_features(product_id, expiry_date);