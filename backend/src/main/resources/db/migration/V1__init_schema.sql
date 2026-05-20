-- FinTrack initial schema (MySQL 8)

CREATE TABLE users (
  id BINARY(16) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(72) NOT NULL,
  phone VARCHAR(20) NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  base_currency_code CHAR(3) NOT NULL DEFAULT 'INR',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE refresh_tokens (
  id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_refresh_tokens_token_hash (token_hash),
  KEY ix_refresh_tokens_user_id (user_id),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE categories (
  id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  type VARCHAR(20) NOT NULL,
  name VARCHAR(80) NOT NULL,
  parent_id BINARY(16) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_categories_user_type (user_id, type),
  KEY ix_categories_user_parent (user_id, parent_id),
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE CASCADE,
  CONSTRAINT ck_categories_type CHECK (type IN ('INCOME','EXPENSE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE recurring_rules (
  id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  type VARCHAR(20) NOT NULL,
  category_id BINARY(16) NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'INR',
  default_expected_amount_minor BIGINT NOT NULL,
  note_template VARCHAR(500) NULL,
  schedule_type VARCHAR(20) NOT NULL,
  schedule_config JSON NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  next_run_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_recurring_user_next (user_id, next_run_date),
  KEY ix_recurring_user_active_next (user_id, is_active, next_run_date),
  CONSTRAINT fk_recurring_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT ck_recurring_type CHECK (type IN ('INCOME','EXPENSE')),
  CONSTRAINT ck_recurring_schedule CHECK (schedule_type IN ('MONTHLY','WEEKLY','YEARLY')),
  CONSTRAINT ck_recurring_amount_nonneg CHECK (default_expected_amount_minor >= 0),
  CONSTRAINT ck_recurring_dates CHECK (end_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE transactions (
  id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  type VARCHAR(20) NOT NULL,
  category_id BINARY(16) NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL,
  expected_amount_minor BIGINT NULL,
  expected_date DATE NULL,
  actual_amount_minor BIGINT NULL,
  actual_date DATE NULL,
  note VARCHAR(500) NULL,
  recurring_rule_id BINARY(16) NULL,
  occurrence_key VARCHAR(120) NULL,
  confirmed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_transactions_rule_occurrence (recurring_rule_id, occurrence_key),
  KEY ix_transactions_user_actual (user_id, actual_date),
  KEY ix_transactions_user_expected (user_id, expected_date),
  KEY ix_transactions_user_category (user_id, category_id),
  KEY ix_transactions_user_status (user_id, status),
  KEY ix_transactions_user_type_actual (user_id, type, actual_date),
  KEY ix_transactions_user_type_expected (user_id, type, expected_date),
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_transactions_recurring FOREIGN KEY (recurring_rule_id) REFERENCES recurring_rules (id) ON DELETE SET NULL,
  CONSTRAINT ck_transactions_type CHECK (type IN ('INCOME','EXPENSE')),
  CONSTRAINT ck_transactions_status CHECK (status IN ('EXPECTED','ACTUAL')),
  CONSTRAINT ck_transactions_expected_amt CHECK (expected_amount_minor IS NULL OR expected_amount_minor >= 0),
  CONSTRAINT ck_transactions_actual_amt CHECK (actual_amount_minor IS NULL OR actual_amount_minor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE asset_categories (
  id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  name VARCHAR(80) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  color VARCHAR(20) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_asset_categories_user_name (user_id, name),
  CONSTRAINT fk_asset_categories_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT ck_asset_categories_kind CHECK (kind IN ('bank','investment','cash','crypto','real_estate','gold','other'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE net_worth_snapshots (
  id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  snapshot_date DATE NOT NULL,
  balances JSON NOT NULL,
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_snapshots_user_date (user_id, snapshot_date),
  CONSTRAINT fk_snapshots_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
