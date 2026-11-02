-- ====================================================================
-- 2026-11-03 웹 업데이트 병합용 마이그레이션 (MySQL 8.x)
-- 대상: triplelingo_sql.sql + updates_sql.sql 로 만든 기존 DB
-- 여러 번 실행해도 안전하도록 information_schema로 존재 여부를 확인 후 변경
-- ====================================================================
USE triplelingodb;

-- --------------------------------------------------------------------
-- 1. scripts.category / scripts.level 추가 (대본 업로드·카테고리 필터용)
-- --------------------------------------------------------------------
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scripts' AND COLUMN_NAME = 'category') = 0,
  "ALTER TABLE scripts ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT '일상회화'",
  'SELECT ''category 이미 존재'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scripts' AND COLUMN_NAME = 'level') = 0,
  "ALTER TABLE scripts ADD COLUMN level VARCHAR(20) NOT NULL DEFAULT '초급'",
  'SELECT ''level 이미 존재'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------------------------------------------------------
-- 2. script_lines.text → dialogue 컬럼명 변경 (main.py 전체가 dialogue 사용)
-- --------------------------------------------------------------------
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'script_lines' AND COLUMN_NAME = 'text') = 1,
  'ALTER TABLE script_lines RENAME COLUMN `text` TO dialogue',
  'SELECT ''dialogue 이미 적용'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 인물명이 긴 대본 대비 50 → 100자
ALTER TABLE script_lines MODIFY COLUMN character_name VARCHAR(100);

-- --------------------------------------------------------------------
-- 3. script_lines FK에 ON DELETE CASCADE 적용 (대본 삭제 시 대사도 함께 삭제)
--    기존 FK 이름은 자동 생성(script_lines_ibfk_1 등)이라 조회해서 삭제
-- --------------------------------------------------------------------
SET @fk := (SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'script_lines'
               AND REFERENCED_TABLE_NAME = 'scripts' AND DELETE_RULE <> 'CASCADE' LIMIT 1);
SET @sql := IF(@fk IS NULL,
  'SELECT ''FK 이미 CASCADE''',
  CONCAT('ALTER TABLE script_lines DROP FOREIGN KEY `', @fk, '`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'script_lines'
      AND REFERENCED_TABLE_NAME = 'scripts') = 0,
  'ALTER TABLE script_lines ADD CONSTRAINT fk_script_lines_script FOREIGN KEY (script_id) REFERENCES scripts(script_id) ON DELETE CASCADE',
  'SELECT ''FK 존재'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------------------------------------------------------
-- 4. 기존 샘플 대본 카테고리 지정 (기존 UploadPage 하드코딩 목록 기준)
-- --------------------------------------------------------------------
UPDATE scripts SET category = '영화/드라마', level = '중급'
 WHERE title LIKE '%Romeo%' OR title LIKE '%Earnest%' OR title LIKE '%Prada%';
UPDATE scripts SET category = '면접', level = '중급' WHERE title LIKE '%Interview Practice%';
UPDATE scripts SET category = 'OPIc', level = '중급' WHERE title LIKE '%OPIc%';
UPDATE scripts SET category = '일상회화', level = '초급'
 WHERE title LIKE '%Meeting a Friend%' OR title LIKE '%At a Cafe%';
UPDATE scripts SET category = '일상회화', level = '중급' WHERE title LIKE '%Shopping for Clothes%';

-- 확인
DESC scripts;
DESC script_lines;
