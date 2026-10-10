-- Household sharing: an owner's data can be viewed and edited by invited members.
-- Domain tables keep user_id as the owning user; membership widens who may act as
-- that user, so no existing table changes shape.

CREATE TABLE household_members (
  id BINARY(16) NOT NULL,
  owner_user_id BINARY(16) NOT NULL,
  member_user_id BINARY(16) NOT NULL,
  role VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- A member belongs to at most one household, so their data scope is unambiguous.
  UNIQUE KEY uk_household_members_member (member_user_id),
  KEY ix_household_members_owner (owner_user_id),
  CONSTRAINT fk_household_members_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_household_members_member FOREIGN KEY (member_user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT ck_household_members_role CHECK (role IN ('MEMBER','VIEWER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE household_invites (
  id BINARY(16) NOT NULL,
  owner_user_id BINARY(16) NOT NULL,
  email VARCHAR(254) NOT NULL,
  role VARCHAR(20) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_household_invites_token_hash (token_hash),
  KEY ix_household_invites_owner (owner_user_id),
  CONSTRAINT fk_household_invites_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT ck_household_invites_role CHECK (role IN ('MEMBER','VIEWER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
