SET @add_workspace_industry = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_sys_workspace'
              AND column_name = 'industry'
        ),
        'SELECT 1',
        'ALTER TABLE tb_sys_workspace ADD COLUMN industry VARCHAR(64) NULL'
    )
);
PREPARE stmt FROM @add_workspace_industry;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE tb_sys_workspace
  MODIFY COLUMN description VARCHAR(500) NULL;

SET @add_workspace_initialization_mode = (
    SELECT IF(
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'tb_sys_workspace'
              AND column_name = 'initialization_mode'
        ),
        'SELECT 1',
        'ALTER TABLE tb_sys_workspace ADD COLUMN initialization_mode VARCHAR(16) NOT NULL DEFAULT ''BLANK'''
    )
);
PREPARE stmt FROM @add_workspace_initialization_mode;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
