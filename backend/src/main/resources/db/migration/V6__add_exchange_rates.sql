CREATE TABLE exchange_rates (
  id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  currency_code CHAR(3) NOT NULL,
  rate_to_base DECIMAL(18,8) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_exchange_rates_user_currency (user_id, currency_code),
  CONSTRAINT fk_exchange_rates_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
