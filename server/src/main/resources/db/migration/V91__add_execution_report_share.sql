CREATE TABLE IF NOT EXISTS tb_exec_report_share (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    report_id BIGINT NOT NULL,
    token_hash VARCHAR(128) NOT NULL,
    status INT NOT NULL DEFAULT 1,
    expires_at TIMESTAMP,
    created_by VARCHAR(128),
    last_accessed_at TIMESTAMP,
    access_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_exec_report_share_report FOREIGN KEY (report_id) REFERENCES tb_exec_report(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_exec_report_share_token ON tb_exec_report_share(token_hash);
CREATE INDEX IF NOT EXISTS idx_exec_report_share_target ON tb_exec_report_share(workspace_id, report_id);
CREATE INDEX IF NOT EXISTS idx_exec_report_share_status ON tb_exec_report_share(status);
