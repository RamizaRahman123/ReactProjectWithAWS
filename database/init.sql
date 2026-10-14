-- Runs automatically ONLY the first time the MySQL volume is created.
-- The database itself (MYSQL_DATABASE) is created by the MySQL image and selected for this script.

CREATE TABLE IF NOT EXISTS messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  message    VARCHAR(500) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO messages (name, message)
VALUES ('ramiza.site', 'First entry, written by database/init.sql when MySQL started for the first time.');
