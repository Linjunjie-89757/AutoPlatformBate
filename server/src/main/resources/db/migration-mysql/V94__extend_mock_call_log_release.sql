SET @add_mock_call_log_release_id = (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_mock_call_log'
              AND column_name = 'release_id'
        ),
        'SELECT 1',
        'ALTER TABLE tb_mock_call_log ADD COLUMN release_id BIGINT NULL'
    )
);
PREPARE stmt FROM @add_mock_call_log_release_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_mock_call_log_release_version = (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_mock_call_log'
              AND column_name = 'release_version'
        ),
        'SELECT 1',
        'ALTER TABLE tb_mock_call_log ADD COLUMN release_version INT NULL'
    )
);
PREPARE stmt FROM @add_mock_call_log_release_version;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @create_mock_call_log_release_idx = (
    SELECT IF(
        EXISTS(
            SELECT 1 FROM information_schema.statistics
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_mock_call_log'
              AND index_name = 'idx_mock_call_log_release'
        ),
        'SELECT 1',
        'CREATE INDEX idx_mock_call_log_release ON tb_mock_call_log (release_id, created_at)'
    )
);
PREPARE stmt FROM @create_mock_call_log_release_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
