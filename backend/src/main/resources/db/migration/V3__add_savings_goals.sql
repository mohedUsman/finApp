CREATE TABLE savings_goals (
  id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  name VARCHAR(100) NOT NULL,
  target_amount_minor BIGINT NOT NULL,
  saved_amount_minor BIGINT NOT NULL DEFAULT 0,
  target_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_savings_goals_user (user_id),
  CONSTRAINT fk_savings_goals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT ck_savings_goals_target_nonneg CHECK (target_amount_minor >= 0),
  CONSTRAINT ck_savings_goals_saved_nonneg CHECK (saved_amount_minor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
