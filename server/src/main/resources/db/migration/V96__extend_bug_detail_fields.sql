ALTER TABLE tb_bug_info ADD COLUMN IF NOT EXISTS reproduction_steps TEXT;
ALTER TABLE tb_bug_info ADD COLUMN IF NOT EXISTS expected_result TEXT;
ALTER TABLE tb_bug_info ADD COLUMN IF NOT EXISTS actual_result TEXT;
ALTER TABLE tb_bug_info ADD COLUMN IF NOT EXISTS module_name VARCHAR(128);
