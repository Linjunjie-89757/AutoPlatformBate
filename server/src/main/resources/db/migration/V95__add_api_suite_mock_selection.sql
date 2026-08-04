ALTER TABLE tb_api_execution_suite
    ADD COLUMN mock_application_id BIGINT NULL;
ALTER TABLE tb_api_execution_suite
    ADD COLUMN mock_release_id BIGINT NULL;
