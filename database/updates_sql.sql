-- ScriptBot 추가 테이블 및 컬럼 (기존 triplelingo_sql.sql 이후 추가분)

-- 1. scripts 테이블에 status 컬럼 추가
ALTER TABLE scripts ADD COLUMN status VARCHAR(20) DEFAULT '분석 중';

-- 2. 대사별 감정 저장 테이블
CREATE TABLE script_lines (
    line_id INT AUTO_INCREMENT PRIMARY KEY,
    script_id INT NOT NULL,
    line_order INT NOT NULL,
    character_name VARCHAR(50),
    text TEXT,
    emotion VARCHAR(20) DEFAULT 'neutral',
    FOREIGN KEY (script_id) REFERENCES scripts(script_id)
);

-- 3. 연습 세션 기록 테이블
CREATE TABLE practice_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    script_id INT NOT NULL,
    chosen_role VARCHAR(50),
    total_lines INT DEFAULT 0,
    average_score FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (script_id) REFERENCES scripts(script_id)
);

-- 4. 테스트 대본 삽입
INSERT INTO scripts (user_id, title, content, status) VALUES (
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
Sara: Yes, let us go. I could really use some rest after all of this.',
'분석 완료'
);