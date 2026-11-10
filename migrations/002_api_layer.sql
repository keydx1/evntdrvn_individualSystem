-- AquaPiol API layer: integration references, idempotency storage, and indexes.
-- Safe to re-run: scripts/migrate-sql.js ignores duplicate column/index errors.

ALTER TABLE stock_movements ADD COLUMN customer_ref VARCHAR(64) NULL;
ALTER TABLE stock_movements ADD COLUMN source_system VARCHAR(32) NULL;
ALTER TABLE stock_movements ADD COLUMN occurred_at DATETIME NULL;

ALTER TABLE users ADD COLUMN external_employee_id VARCHAR(64) NULL;

CREATE INDEX idx_sm_customer_ref ON stock_movements (customer_ref);
CREATE INDEX idx_sm_occurred_at ON stock_movements (occurred_at);
CREATE INDEX idx_sm_source_created ON stock_movements (source_system, createdAt);
CREATE INDEX idx_products_active_sku ON products (isActive, sku);

CREATE UNIQUE INDEX uq_movement_product_reference_type
  ON stock_movements (productId, reference, type);
CREATE UNIQUE INDEX uq_users_external_employee
  ON users (external_employee_id);

CREATE TABLE IF NOT EXISTS api_idempotency (
  id INT NOT NULL AUTO_INCREMENT,
  service VARCHAR(32) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  endpoint VARCHAR(120) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  response_status INT NOT NULL,
  response_body LONGTEXT NOT NULL,
  expires_at DATETIME NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_idem_service_key (service, idempotency_key),
  KEY idx_idem_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
