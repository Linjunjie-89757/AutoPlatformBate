ALTER TABLE tb_sys_workspace_join_application
    ADD COLUMN IF NOT EXISTS reject_reason VARCHAR(500);
