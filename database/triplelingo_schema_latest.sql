-- Triplelingo: schema-only snapshot based on SHOW CREATE TABLE outputs
-- Execute only against a NEW/EMPTY database for setup; no sample data included.
-- Existing tables are not altered by this file (CREATE TABLE IF NOT EXISTS).
CREATE DATABASE IF NOT EXISTS `triplelingodb` CHARACTER SET utf8mb4;
USE `triplelingodb`;

CREATE TABLE IF NOT EXISTS `users` (
  `user_id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  `nickname` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `login_type` varchar(50) DEFAULT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `social_provider` varchar(50) DEFAULT NULL,
  `social_id` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `scripts` (
  `script_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL DEFAULT '1',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '일상회화',
  `level` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '초급',
  PRIMARY KEY (`script_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `script_lines` (
  `line_id` int NOT NULL AUTO_INCREMENT,
  `script_id` int NOT NULL,
  `line_order` int NOT NULL,
  `character_name` varchar(100) NOT NULL,
  `dialogue` text NOT NULL,
  `emotion` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`line_id`),
  KEY `fk_script_lines_script` (`script_id`),
  CONSTRAINT `fk_script_lines_script` FOREIGN KEY (`script_id`) REFERENCES `scripts` (`script_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `practice_results` (
  `result_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `script_id` int NOT NULL,
  `role_name` varchar(100) DEFAULT NULL,
  `score` int NOT NULL,
  `accuracy_score` int DEFAULT NULL,
  `fluency_score` int DEFAULT NULL,
  `pronunciation_score` int DEFAULT NULL,
  `practiced_lines` int DEFAULT '0',
  `practiced_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`result_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
