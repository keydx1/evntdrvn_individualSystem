-- Integration indexes required by the accounting/customer query patterns.
-- Split out because 002_api_layer.sql is already recorded as applied on existing databases.

CREATE INDEX idx_sm_product_created ON stock_movements (productId, createdAt);
CREATE INDEX idx_sm_reference ON stock_movements (reference);
