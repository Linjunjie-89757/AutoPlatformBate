CREATE TABLE IF NOT EXISTS tb_sys_workspace_role (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    role_code VARCHAR(64) NOT NULL,
    role_name VARCHAR(128) NOT NULL,
    description VARCHAR(500) NULL,
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_workspace_role_code (workspace_id, role_code),
    UNIQUE KEY uk_workspace_role_name (workspace_id, role_name),
    KEY idx_workspace_role_status (workspace_id, status)
);
