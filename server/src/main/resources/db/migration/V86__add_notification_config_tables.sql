CREATE TABLE IF NOT EXISTS tb_notification_channel (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    channel_name VARCHAR(255) NOT NULL,
    channel_type VARCHAR(64) NOT NULL,
    webhook_url VARCHAR(1024) NOT NULL,
    secret_key VARCHAR(255),
    http_method VARCHAR(16) NOT NULL DEFAULT 'POST',
    headers_json TEXT,
    body_template TEXT,
    timeout_ms INT NOT NULL DEFAULT 5000,
    retry_count INT NOT NULL DEFAULT 2,
    status INT NOT NULL DEFAULT 1,
    remark TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_channel_workspace ON tb_notification_channel(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notification_channel_type ON tb_notification_channel(channel_type);
CREATE INDEX IF NOT EXISTS idx_notification_channel_status ON tb_notification_channel(status);

CREATE TABLE IF NOT EXISTS tb_notification_rule (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    trigger_condition VARCHAR(32) NOT NULL DEFAULT 'ALWAYS',
    channel_ids_json TEXT NOT NULL,
    frequency_limit_seconds INT NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMP,
    status INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_rule_workspace ON tb_notification_rule(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notification_rule_event ON tb_notification_rule(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_rule_status ON tb_notification_rule(status);

CREATE TABLE IF NOT EXISTS tb_notification_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    rule_id BIGINT,
    rule_name VARCHAR(255),
    channel_id BIGINT,
    channel_name VARCHAR(255),
    event_type VARCHAR(64) NOT NULL,
    event_title VARCHAR(255) NOT NULL,
    target_type VARCHAR(64),
    target_id BIGINT,
    target_name VARCHAR(255),
    send_status VARCHAR(32) NOT NULL,
    request_payload TEXT,
    response_body TEXT,
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    triggered_at TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_record_workspace ON tb_notification_record(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notification_record_event ON tb_notification_record(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_record_status ON tb_notification_record(send_status);
CREATE INDEX IF NOT EXISTS idx_notification_record_created ON tb_notification_record(created_at);

ALTER TABLE tb_web_ui_run
    ADD COLUMN IF NOT EXISTS operator_id BIGINT;
