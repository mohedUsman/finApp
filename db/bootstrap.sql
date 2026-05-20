-- One-shot setup for local MySQL 8.
-- Run as root once:
--   mysql -u root -p < db/bootstrap.sql
-- Then set DATASOURCE_PASSWORD in .env to match the password below.

CREATE DATABASE IF NOT EXISTS fintrack
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'fintrack'@'localhost' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON fintrack.* TO 'fintrack'@'localhost';
FLUSH PRIVILEGES;
