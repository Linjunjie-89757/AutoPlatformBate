UPDATE tb_ai_case_config
SET max_cases = 100
WHERE role_type = 'CASE_GENERATOR'
  AND (max_cases IS NULL OR max_cases < 100);

ALTER TABLE tb_ai_case_config
    MODIFY COLUMN max_cases INT NOT NULL DEFAULT 200;

ALTER TABLE tb_ai_generation_task
    ADD COLUMN case_generation_limit INT NOT NULL DEFAULT 200 AFTER output_mode;
