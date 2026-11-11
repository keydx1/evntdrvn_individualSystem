-- 004_reporting_views.sql
-- Read-only reporting views for other systems (POS, HR, Accounting, Customers Log).
--
-- Base tables stay owned by this app: all WRITES must go through the REST API
-- (/api/v1) so stock stays transactional, auditable and idempotent.
-- External systems only get SELECT on the views below.
--
-- Safe to re-run (CREATE OR REPLACE).
-- Apply with: mysql -u root aquapiol_inventory < migrations/004_reporting_views.sql

CREATE OR REPLACE VIEW v_products AS
SELECT
  p.id,
  p.sku,
  p.name,
  c.name                     AS category,
  s.name                     AS supplier,
  p.unit,
  p.quantity,
  p.reorderLevel             AS reorder_level,
  p.costPrice                AS cost_price,
  p.sellingPrice             AS selling_price,
  (p.quantity * p.costPrice) AS stock_value,
  CASE
    WHEN p.quantity <= 0 THEN 'out_of_stock'
    WHEN p.quantity <= p.reorderLevel THEN 'low_stock'
    ELSE 'ok'
  END                        AS stock_status,
  p.location,
  p.isActive                 AS is_active,
  p.createdAt                AS created_at,
  p.updatedAt                AS updated_at
FROM products p
LEFT JOIN categories c ON c.id = p.categoryId
LEFT JOIN suppliers  s ON s.id = p.supplierId;

CREATE OR REPLACE VIEW v_stock_ledger AS
SELECT
  m.id,
  m.occurred_at,
  m.createdAt                                      AS recorded_at,
  p.sku,
  p.name                                           AS product_name,
  m.type,
  m.quantity,
  m.previousStock                                  AS previous_stock,
  m.newStock                                       AS new_stock,
  m.unitCost                                       AS unit_cost,
  (m.quantity * COALESCE(m.unitCost, p.costPrice)) AS movement_value,
  m.reference,
  m.notes,
  m.customer_ref,
  m.source_system,
  u.name                                           AS recorded_by,
  u.external_employee_id                           AS employee_ref,
  s.name                                           AS supplier
FROM stock_movements m
JOIN products p       ON p.id = m.productId
LEFT JOIN users u     ON u.id = m.userId
LEFT JOIN suppliers s ON s.id = m.supplierId;

CREATE OR REPLACE VIEW v_stock_alerts AS
SELECT
  p.sku,
  p.name,
  p.quantity,
  p.reorderLevel                AS reorder_level,
  (p.reorderLevel - p.quantity) AS shortfall,
  p.unit
FROM products p
WHERE p.isActive = 1
  AND p.quantity <= p.reorderLevel;

CREATE OR REPLACE VIEW v_inventory_valuation AS
SELECT
  p.sku,
  p.name,
  p.quantity,
  p.costPrice                AS unit_cost,
  (p.quantity * p.costPrice) AS stock_value,
  p.isActive                 AS is_active
FROM products p;
