ALTER TABLE tb_api_execution_suite
    ADD COLUMN mock_application_id BIGINT NULL AFTER variable_set_id,
    ADD COLUMN mock_release_id BIGINT NULL AFTER mock_application_id;
