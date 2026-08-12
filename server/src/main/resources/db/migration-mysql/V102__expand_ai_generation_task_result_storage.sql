ALTER TABLE tb_ai_generation_task
    MODIFY COLUMN warnings_json MEDIUMTEXT NULL,
    MODIFY COLUMN invalid_cases_json MEDIUMTEXT NULL,
    MODIFY COLUMN generated_cases_json MEDIUMTEXT NULL,
    MODIFY COLUMN review_result_json MEDIUMTEXT NULL,
    MODIFY COLUMN generation_raw_output MEDIUMTEXT NULL,
    MODIFY COLUMN review_raw_output MEDIUMTEXT NULL;
