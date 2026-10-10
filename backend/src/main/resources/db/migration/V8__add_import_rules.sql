-- Keyword rules that map a bank statement description to a category during
-- CSV import. Checked longest-keyword-first so a specific rule wins over a
-- broad one.

CREATE TABLE import_rules (
  id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  keyword VARCHAR(120) NOT NULL,
  category_id BINARY(16) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_import_rules_user_keyword (user_id, keyword),
  KEY ix_import_rules_user (user_id),
  CONSTRAINT fk_import_rules_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_import_rules_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
