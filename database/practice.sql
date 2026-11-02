USE triplelingodb;

CREATE TABLE IF NOT EXISTS practice_results (
    result_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    script_id INT NOT NULL,
    role_name VARCHAR(100),
    

    score INT NOT NULL,
    accuracy_score INT,
    fluency_score INT,
    pronunciation_score INT,

    practiced_lines INT DEFAULT 0,
    practiced_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DESC practice_results;