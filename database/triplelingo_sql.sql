CREATE DATABASE IF NOT EXISTS triplelingodb;
USE triplelingodb;

-- 1. Create the user management platform profile framework table
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50),
    nickname VARCHAR(50),
    email VARCHAR(100) UNIQUE, -- Added UNIQUE constraint to match registration rules
    password VARCHAR(255),
    login_type VARCHAR(50),
    profile_image VARCHAR(255),
    status VARCHAR(50) DEFAULT 'ACTIVE', -- Added status tracker field to match main.py checks
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    social_provider VARCHAR(50),
    social_id VARCHAR(100)
);

-- 2. Create the practice scenario dialog scripts data logging table
CREATE TABLE IF NOT EXISTS scripts (
    script_id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (script_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3. Ingest sandbox user profiles rows
INSERT INTO users 
(name, nickname, email, password, login_type, status, profile_image, social_provider, social_id)
VALUES
('홍길동', '길동이', 'hong@example.com', '12345678', 'LOCAL', 'ACTIVE', NULL, NULL, NULL),
('김철수', '철수', 'kim@example.com', '12345678', 'LOCAL', 'ACTIVE', NULL, NULL, NULL),
('관리자', '어드민', 'admin@example.com', 'admin1234', 'LOCAL', 'ACTIVE', NULL, NULL, NULL), -- Added to match your admin user layout checks
('이소셜', '소셜유저', 'social@example.com', NULL, 'SOCIAL', 'ACTIVE', NULL, 'KAKAO', 'kakao_12345');


INSERT INTO scripts (user_id, title, content)
VALUES
(
1,
'Romeo and Juliet - Balcony Scene',
'Romeo: But, soft! What light through yonder window breaks?
Juliet: O Romeo, Romeo! Wherefore art thou Romeo?
Romeo: Shall I hear more, or shall I speak at this?
Juliet: Deny thy father and refuse thy name.
Romeo: I take thee at thy word.'
),

(
1,
'The Importance of Being Earnest',
'Jack: I am in love with Gwendolen.
Algernon: I thought you had come up for pleasure.
Jack: I call that business.
Algernon: How utterly unromantic you are!'
),

(
1,
'Emotion Practice Script',
'Alex: I cannot believe how wonderful this day has turned out to be!
Sara: You always say that, but today truly does feel special.
Alex: Wait, did you hear that? Something is out there in the dark.
Sara: I heard it too. My heart is pounding so fast right now.
Alex: Oh my goodness! I never expected to see you here like this!
Sara: I know! This is the last place I ever thought we would meet.
Alex: How could you do this to me? After everything we have been through!
Sara: I did not mean to hurt you. I was just trying to protect us both.
Alex: I miss the way things used to be between us. It breaks my heart.
Sara: Me too. Those memories are all I have left to hold onto now.
Alex: The smell of that rotten food is absolutely making me sick.
Sara: I completely agree. I cannot stand being near it for another second.
Alex: So, shall we head home now? It has been quite a long day.
Sara: Yes, let us go. I could really use some rest after all of this.'
);


-- 5. Run diagnostic execution validations
SELECT * FROM users;
SELECT script_id, title, CHAR_LENGTH(content) AS script_character_count FROM scripts;