CREATE TABLE IF NOT EXISTS tb_platform_account_invitation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP NULL,
    revoked_at TIMESTAMP NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_platform_account_invitation_token
    ON tb_platform_account_invitation(token_hash);
CREATE INDEX IF NOT EXISTS idx_platform_account_invitation_user
    ON tb_platform_account_invitation(user_id, created_at);

CREATE TABLE IF NOT EXISTS tb_platform_notification_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INT NOT NULL,
    smtp_username VARCHAR(255) NOT NULL,
    smtp_password_cipher_text CLOB NOT NULL,
    encryption VARCHAR(32) NOT NULL,
    sender_name VARCHAR(128) NOT NULL,
    rules_json CLOB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
