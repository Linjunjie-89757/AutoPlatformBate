ALTER TABLE tb_mock_call_log ADD COLUMN IF NOT EXISTS release_id BIGINT;
ALTER TABLE tb_mock_call_log ADD COLUMN IF NOT EXISTS release_version INT;

CREATE INDEX IF NOT EXISTS idx_mock_call_log_release
    ON tb_mock_call_log (release_id, created_at);
