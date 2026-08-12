ALTER TABLE tb_ai_generation_task ALTER COLUMN warnings_json CLOB;
ALTER TABLE tb_ai_generation_task ALTER COLUMN invalid_cases_json CLOB;
ALTER TABLE tb_ai_generation_task ALTER COLUMN generated_cases_json CLOB;
ALTER TABLE tb_ai_generation_task ALTER COLUMN review_result_json CLOB;
ALTER TABLE tb_ai_generation_task ALTER COLUMN generation_raw_output CLOB;
ALTER TABLE tb_ai_generation_task ALTER COLUMN review_raw_output CLOB;
