CREATE TABLE IF NOT EXISTS tb_test_plan_case_defect (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    plan_case_id BIGINT NOT NULL,
    defect_id BIGINT NOT NULL,
    created_by BIGINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_test_plan_case_defect (plan_case_id, defect_id),
    KEY idx_test_plan_defect_plan (workspace_id, plan_id, defect_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tb_test_plan_case_execution_attachment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    plan_case_id BIGINT NOT NULL,
    execution_id BIGINT NULL,
    file_name VARCHAR(255) NOT NULL,
    stored_path VARCHAR(512) NOT NULL,
    content_type VARCHAR(128),
    file_size BIGINT,
    created_by BIGINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_test_plan_execution_attachment (workspace_id, execution_id),
    KEY idx_test_plan_execution_attachment_case (workspace_id, plan_id, plan_case_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
