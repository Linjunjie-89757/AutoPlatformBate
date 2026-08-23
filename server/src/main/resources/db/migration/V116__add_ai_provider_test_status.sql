ALTER TABLE tb_ai_provider_connection
    ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMP NULL;

ALTER TABLE tb_ai_provider_connection
    ADD COLUMN IF NOT EXISTS last_test_status VARCHAR(16) NULL;

ALTER TABLE tb_ai_provider_connection
    ADD COLUMN IF NOT EXISTS last_test_message VARCHAR(2000) NULL;
