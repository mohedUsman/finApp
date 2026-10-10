CREATE TABLE tags (
  id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#64748b',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tags_user_name (user_id, name),
  CONSTRAINT fk_tags_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE transaction_tags (
  transaction_id BINARY(16) NOT NULL,
  tag_id BINARY(16) NOT NULL,
  PRIMARY KEY (transaction_id, tag_id),
  KEY ix_transaction_tags_tag (tag_id),
  CONSTRAINT fk_tt_transaction FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
  CONSTRAINT fk_tt_tag FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
