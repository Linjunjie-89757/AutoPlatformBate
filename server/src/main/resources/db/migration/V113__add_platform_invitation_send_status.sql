ALTER TABLE tb_platform_account_invitation
    ADD COLUMN IF NOT EXISTS send_status VARCHAR(32) DEFAULT 'SENT';
ALTER TABLE tb_platform_account_invitation
    ADD COLUMN IF NOT EXISTS send_error VARCHAR(500);
ALTER TABLE tb_platform_account_invitation
    ADD COLUMN IF NOT EXISTS send_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE tb_platform_account_invitation
    ADD COLUMN IF NOT EXISTS last_send_at TIMESTAMP;
ALTER TABLE tb_platform_account_invitation
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;

UPDATE tb_platform_account_invitation
SET send_status = 'SENT'
WHERE send_status IS NULL;
