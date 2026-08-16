ALTER TABLE tb_exec_task
    ADD COLUMN creator_user_id BIGINT NULL;

CREATE TABLE IF NOT EXISTS tb_platform_login_failure_state (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_key VARCHAR(255) NOT NULL,
    failure_count INT NOT NULL,
    window_started_at TIMESTAMP NOT NULL,
    last_failed_at TIMESTAMP NOT NULL,
    alerted_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_platform_login_failure_account
    ON tb_platform_login_failure_state(account_key);

CREATE TABLE IF NOT EXISTS tb_platform_notification_delivery (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_key VARCHAR(255) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    last_error VARCHAR(500) NULL,
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_platform_notification_delivery
    ON tb_platform_notification_delivery(event_key, recipient);
