ALTER TABLE tb_platform_account_invitation
    ADD COLUMN send_status VARCHAR(32) NOT NULL DEFAULT 'SENT',
    ADD COLUMN send_error VARCHAR(500) NULL,
    ADD COLUMN send_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN last_send_at DATETIME NULL,
    ADD COLUMN sent_at DATETIME NULL;
