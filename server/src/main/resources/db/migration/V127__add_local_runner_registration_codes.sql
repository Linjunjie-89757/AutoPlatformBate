CREATE TABLE IF NOT EXISTS tb_local_runner_registration_code (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code_hash VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    used_runner_id VARCHAR(128),
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_local_runner_registration_code_hash UNIQUE (code_hash)
);

CREATE INDEX idx_local_runner_registration_code_status_expiry
    ON tb_local_runner_registration_code (status, expires_at);
