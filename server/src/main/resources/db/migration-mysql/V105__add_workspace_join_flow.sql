CREATE TABLE IF NOT EXISTS tb_sys_workspace_join_application (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    applicant_user_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_workspace_join_application_workspace
        FOREIGN KEY (workspace_id) REFERENCES tb_sys_workspace(id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_join_application_user
        FOREIGN KEY (applicant_user_id) REFERENCES tb_sys_user(id) ON DELETE CASCADE,
    INDEX idx_workspace_join_application_applicant (applicant_user_id, status, created_at),
    INDEX idx_workspace_join_application_workspace (workspace_id, status, created_at)
);

CREATE TABLE IF NOT EXISTS tb_sys_workspace_invitation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    invite_code_hash VARCHAR(64) NOT NULL,
    created_by BIGINT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    max_uses INT NOT NULL DEFAULT 20,
    used_count INT NOT NULL DEFAULT 0,
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_workspace_invitation_workspace
        FOREIGN KEY (workspace_id) REFERENCES tb_sys_workspace(id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_invitation_creator
        FOREIGN KEY (created_by) REFERENCES tb_sys_user(id) ON DELETE CASCADE,
    UNIQUE KEY uk_workspace_invitation_hash (invite_code_hash),
    INDEX idx_workspace_invitation_workspace (workspace_id, status, expires_at)
);
