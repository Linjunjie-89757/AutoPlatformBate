ALTER TABLE tb_sys_user
    ADD COLUMN IF NOT EXISTS creation_source VARCHAR(32) DEFAULT 'MANUAL';

UPDATE tb_sys_user
SET creation_source = 'MANUAL'
WHERE creation_source IS NULL;
