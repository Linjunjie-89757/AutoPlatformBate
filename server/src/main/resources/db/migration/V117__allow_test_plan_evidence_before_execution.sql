ALTER TABLE tb_test_plan_case_execution_attachment
    ALTER COLUMN execution_id BIGINT NULL;

CREATE INDEX IF NOT EXISTS idx_test_plan_execution_attachment_case
    ON tb_test_plan_case_execution_attachment (workspace_id, plan_id, plan_case_id, id);
