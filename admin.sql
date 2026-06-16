CREATE DATABASE IF NOT EXISTS admin_project;
USE admin_project;

CREATE TABLE users (
    user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50),
    nickname VARCHAR(50),
    email VARCHAR(100),
    password VARCHAR(255),
    login_type VARCHAR(50),
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    social_provider VARCHAR(50),
    social_id VARCHAR(100)
);

INSERT INTO users 
(name, nickname, email, password, login_type, profile_image, social_provider, social_id)
VALUES
('홍길동', '길동이', 'hong@example.com', '1234', 'LOCAL', NULL, NULL, NULL),
('김철수', '철수', 'kim@example.com', '1234', 'LOCAL', NULL, NULL, NULL),
('이소셜', '소셜유저', 'social@example.com', NULL, 'SOCIAL', NULL, 'KAKAO', 'kakao_12345');