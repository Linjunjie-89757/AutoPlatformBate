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
    UNIQUE KEY uq_local_runner_registration_code_hash (code_hash),
    KEY idx_local_runner_registration_code_status_expiry (status, expires_at)
);
