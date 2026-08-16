ALTER TABLE tb_exec_task
    ADD COLUMN creator_user_id BIGINT NULL;

CREATE TABLE IF NOT EXISTS tb_platform_login_failure_state (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_key VARCHAR(255) NOT NULL,
    failure_count INT NOT NULL,
    window_started_at DATETIME NOT NULL,
    last_failed_at DATETIME NOT NULL,
    alerted_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_platform_login_failure_account (account_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tb_platform_notification_delivery (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_key VARCHAR(255) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    last_error VARCHAR(500) NULL,
    sent_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_platform_notification_delivery (event_key, recipient)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
