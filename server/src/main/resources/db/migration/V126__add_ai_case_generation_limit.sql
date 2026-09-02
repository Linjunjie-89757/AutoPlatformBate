UPDATE tb_ai_case_config
SET max_cases = 100
WHERE role_type = 'CASE_GENERATOR'
  AND (max_cases IS NULL OR max_cases < 100);

ALTER TABLE tb_ai_case_config ALTER COLUMN max_cases SET DEFAULT 200;

ALTER TABLE tb_ai_generation_task ADD COLUMN case_generation_limit INT DEFAULT 200;

UPDATE tb_ai_generation_task
SET case_generation_limit = 200
WHERE case_generation_limit IS NULL;

ALTER TABLE tb_ai_generation_task
    ALTER COLUMN case_generation_limit SET DEFAULT 200;
ALTER TABLE tb_ai_generation_task
    ALTER COLUMN case_generation_limit SET NOT NULL;
