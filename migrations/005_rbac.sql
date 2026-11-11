-- 005_rbac.sql
-- Database-backed role based access control.
--
-- Replaces the hard-coded admin/staff pair with a `roles` table so new roles
-- (manager, viewer, custom roles) can be created from the UI without a deploy.
-- `users.role` keeps storing the role key, so existing accounts keep working.

CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(32) NOT NULL,
  name VARCHAR(60) NOT NULL,
  description VARCHAR(255) NULL,
  permissions JSON NOT NULL,
  isSystem TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Widen the old ENUM so custom role keys can be stored.
ALTER TABLE users MODIFY COLUMN role VARCHAR(32) NOT NULL DEFAULT 'staff';

INSERT INTO roles (`key`, name, description, permissions, isSystem, createdAt, updatedAt) VALUES
  ('admin', 'Administrator', 'Full access, including user and role administration.',
   '["dashboard.view","products.view","products.manage","categories.view","categories.manage","suppliers.view","suppliers.manage","stock.view","stock.record","reports.view","reports.export","users.manage","roles.manage"]',
   1, NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), permissions = VALUES(permissions), isSystem = VALUES(isSystem);

INSERT INTO roles (`key`, name, description, permissions, isSystem, createdAt, updatedAt) VALUES
  ('manager', 'Station manager', 'Runs inventory, pricing and reports but cannot manage accounts.',
   '["dashboard.view","products.view","products.manage","categories.view","categories.manage","suppliers.view","suppliers.manage","stock.view","stock.record","reports.view","reports.export"]',
   1, NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), permissions = VALUES(permissions), isSystem = VALUES(isSystem);

INSERT INTO roles (`key`, name, description, permissions, isSystem, createdAt, updatedAt) VALUES
  ('staff', 'Station staff', 'Records stock movements and reads inventory and reports.',
   '["dashboard.view","products.view","categories.view","suppliers.view","stock.view","stock.record","reports.view"]',
   1, NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), permissions = VALUES(permissions), isSystem = VALUES(isSystem);

INSERT INTO roles (`key`, name, description, permissions, isSystem, createdAt, updatedAt) VALUES
  ('viewer', 'Read-only viewer', 'Can look at stock, catalogue and reports but cannot change anything.',
   '["dashboard.view","products.view","categories.view","suppliers.view","stock.view","reports.view"]',
   1, NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), permissions = VALUES(permissions), isSystem = VALUES(isSystem);

CREATE INDEX idx_users_role ON users (role);
