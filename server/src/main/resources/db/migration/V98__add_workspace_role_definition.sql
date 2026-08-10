CREATE TABLE IF NOT EXISTS tb_sys_workspace_role (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    role_code VARCHAR(64) NOT NULL,
    role_name VARCHAR(128) NOT NULL,
    description VARCHAR(500),
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_workspace_role_code
    ON tb_sys_workspace_role (workspace_id, role_code);
CREATE UNIQUE INDEX IF NOT EXISTS uk_workspace_role_name
    ON tb_sys_workspace_role (workspace_id, role_name);
CREATE INDEX IF NOT EXISTS idx_workspace_role_status
    ON tb_sys_workspace_role (workspace_id, status);
