CREATE TABLE IF NOT EXISTS tb_mock_release (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    app_id BIGINT NOT NULL,
    version_no INT NOT NULL,
    release_name VARCHAR(255) NOT NULL,
    snapshot_json LONGTEXT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_mock_release_app_version (app_id, version_no),
    KEY idx_mock_release_app_active (app_id, is_active)
);
