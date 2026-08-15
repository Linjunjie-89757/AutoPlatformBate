ALTER TABLE tb_sys_workspace
  ADD COLUMN IF NOT EXISTS industry VARCHAR(64);

ALTER TABLE tb_sys_workspace
  ADD COLUMN IF NOT EXISTS initialization_mode VARCHAR(16) NOT NULL DEFAULT 'BLANK';

ALTER TABLE tb_sys_workspace
  ALTER COLUMN description VARCHAR(500);
