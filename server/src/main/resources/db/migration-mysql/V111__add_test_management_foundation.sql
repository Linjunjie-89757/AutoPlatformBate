CREATE TABLE IF NOT EXISTS tb_test_version (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    version_no VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    version_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    owner_id BIGINT NOT NULL,
    start_date DATE,
    test_date DATE,
    release_date DATE,
    goal TEXT,
    lock_version INT NOT NULL DEFAULT 0,
    archived_at DATETIME NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_test_version_no (workspace_id, version_no),
    UNIQUE KEY uk_test_version_name (workspace_id, name),
    KEY idx_test_version_status (workspace_id, status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tb_test_requirement (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    requirement_no VARCHAR(64) NOT NULL,
    version_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    priority VARCHAR(16) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    source_ref VARCHAR(255),
    assignee_id BIGINT,
    description TEXT,
    lock_version INT NOT NULL DEFAULT 0,
    deleted_at DATETIME NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_test_requirement_no (workspace_id, requirement_no),
    KEY idx_test_requirement_version (workspace_id, version_id, updated_at),
    KEY idx_test_requirement_assignee (workspace_id, assignee_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tb_test_requirement_case (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    requirement_id BIGINT NOT NULL,
    case_id BIGINT NOT NULL,
    review_status VARCHAR(32) NOT NULL,
    review_note TEXT,
    reviewer_id BIGINT,
    reviewed_at DATETIME NULL,
    case_updated_at_when_reviewed DATETIME NULL,
    created_by BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_test_requirement_case (requirement_id, case_id),
    KEY idx_test_requirement_case_status (workspace_id, requirement_id, review_status),
    KEY idx_test_requirement_case_asset (workspace_id, case_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tb_test_plan (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    plan_no VARCHAR(64) NOT NULL,
    purpose VARCHAR(32) NOT NULL,
    plan_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    version_id BIGINT,
    name VARCHAR(255) NOT NULL,
    owner_id BIGINT,
    start_date DATE,
    end_date DATE,
    goal TEXT,
    min_execute_rate DECIMAL(5, 2) NOT NULL DEFAULT 90,
    min_pass_rate DECIMAL(5, 2) NOT NULL DEFAULT 85,
    allow_p0 TINYINT(1) NOT NULL DEFAULT 0,
    max_p1 INT NOT NULL DEFAULT 3,
    auto_report TINYINT(1) NOT NULL DEFAULT 1,
    owner_confirm_required TINYINT(1) NOT NULL DEFAULT 1,
    snapshot_frozen_at DATETIME NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    cancel_reason TEXT,
    lock_version INT NOT NULL DEFAULT 0,
    deleted_at DATETIME NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_test_plan_no (workspace_id, plan_no),
    KEY idx_test_plan_version (workspace_id, version_id, status),
    KEY idx_test_plan_owner (workspace_id, owner_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tb_test_plan_requirement (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    requirement_id BIGINT NOT NULL,
    created_by BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_test_plan_requirement (plan_id, requirement_id),
    KEY idx_test_plan_requirement_req (workspace_id, requirement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tb_test_plan_case (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    source_case_id BIGINT NOT NULL,
    origin_type VARCHAR(32) NOT NULL,
    snapshot_case_no VARCHAR(64) NOT NULL,
    snapshot_title VARCHAR(255) NOT NULL,
    snapshot_module VARCHAR(255),
    snapshot_priority VARCHAR(16) NOT NULL,
    snapshot_precondition TEXT,
    snapshot_steps LONGTEXT,
    snapshot_expected_result TEXT,
    source_case_updated_at DATETIME NULL,
    added_after_start TINYINT(1) NOT NULL DEFAULT 0,
    assignee_id BIGINT,
    execution_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    execution_note TEXT,
    executed_by BIGINT,
    executed_at DATETIME NULL,
    sort_order INT NOT NULL DEFAULT 0,
    lock_version INT NOT NULL DEFAULT 0,
    created_by BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_test_plan_case_source (plan_id, source_case_id),
    KEY idx_test_plan_case_status (workspace_id, plan_id, execution_status),
    KEY idx_test_plan_case_assignee (workspace_id, assignee_id, execution_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tb_test_plan_case_requirement (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    plan_case_id BIGINT NOT NULL,
    requirement_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_test_plan_case_req (plan_case_id, requirement_id),
    KEY idx_test_plan_case_req_requirement (workspace_id, requirement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tb_test_plan_case_execution (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    plan_case_id BIGINT NOT NULL,
    previous_status VARCHAR(32) NOT NULL,
    execution_status VARCHAR(32) NOT NULL,
    execution_note TEXT,
    executor_id BIGINT NOT NULL,
    executed_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_test_plan_case_execution (workspace_id, plan_case_id, executed_at),
    KEY idx_test_plan_execution_plan (workspace_id, plan_id, executed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tb_test_plan_report (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    content_snapshot_json LONGTEXT NOT NULL,
    generated_at DATETIME NOT NULL,
    signed_by BIGINT,
    signed_at DATETIME NULL,
    signature_revoked_by BIGINT,
    signature_revoked_at DATETIME NULL,
    lock_version INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_test_plan_report_plan (plan_id),
    KEY idx_test_plan_report_workspace (workspace_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tb_test_activity_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id BIGINT NOT NULL,
    action_code VARCHAR(64) NOT NULL,
    action_name VARCHAR(128) NOT NULL,
    detail TEXT,
    actor_id BIGINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_test_activity_entity (workspace_id, entity_type, entity_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE tb_bug_info
    ADD COLUMN test_version_id BIGINT NULL,
    ADD COLUMN test_requirement_id BIGINT NULL,
    ADD COLUMN test_plan_id BIGINT NULL,
    ADD COLUMN test_plan_case_id BIGINT NULL,
    ADD KEY idx_bug_test_version (workspace_id, test_version_id, status),
    ADD KEY idx_bug_test_plan (workspace_id, test_plan_id, status),
    ADD KEY idx_bug_test_requirement (workspace_id, test_requirement_id, status);

INSERT INTO tb_sys_permission (
    permission_code, module_code, module_name, action_code, action_name, risky, status, sort_order
) VALUES
    ('test_management.view', 'test_management', '测试管理', 'view', '查看', 0, 1, 351),
    ('test_management.create', 'test_management', '测试管理', 'create', '新建', 0, 1, 352),
    ('test_management.edit', 'test_management', '测试管理', 'edit', '编辑', 0, 1, 353),
    ('test_management.delete', 'test_management', '测试管理', 'delete', '删除', 1, 1, 354),
    ('test_management.review', 'test_management', '测试管理', 'review', '评审', 1, 1, 355),
    ('test_management.execute', 'test_management', '测试管理', 'execute', '执行', 0, 1, 356),
    ('test_management.release', 'test_management', '测试管理', 'release', '发布与强制准出', 1, 1, 357),
    ('test_management.export', 'test_management', '测试管理', 'export', '导出', 0, 1, 358)
ON DUPLICATE KEY UPDATE
    module_name = VALUES(module_name),
    action_name = VALUES(action_name),
    risky = VALUES(risky),
    status = VALUES(status),
    sort_order = VALUES(sort_order),
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO tb_sys_workspace_role_permission (role_id, permission_code, created_at, updated_at)
SELECT role_definition.id, permission.permission_code, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM tb_sys_workspace_role role_definition
JOIN tb_sys_permission permission ON permission.module_code = 'test_management'
WHERE role_definition.role_code = 'SYSTEM_TEST_LEAD'
  AND NOT EXISTS (
      SELECT 1 FROM tb_sys_workspace_role_permission binding
      WHERE binding.role_id = role_definition.id
        AND binding.permission_code = permission.permission_code
  );

INSERT INTO tb_sys_workspace_role_permission (role_id, permission_code, created_at, updated_at)
SELECT role_definition.id, permission.permission_code, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM tb_sys_workspace_role role_definition
JOIN tb_sys_permission permission
  ON permission.permission_code IN (
      'test_management.view', 'test_management.create', 'test_management.edit',
      'test_management.execute', 'test_management.export'
  )
WHERE role_definition.role_code = 'SYSTEM_TEST_ENGINEER'
  AND NOT EXISTS (
      SELECT 1 FROM tb_sys_workspace_role_permission binding
      WHERE binding.role_id = role_definition.id
        AND binding.permission_code = permission.permission_code
  );

INSERT INTO tb_sys_workspace_role_permission (role_id, permission_code, created_at, updated_at)
SELECT role_definition.id, permission.permission_code, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM tb_sys_workspace_role role_definition
JOIN tb_sys_permission permission ON permission.permission_code = 'test_management.view'
WHERE role_definition.role_code IN ('SYSTEM_DEVELOPER', 'SYSTEM_READ_ONLY')
  AND NOT EXISTS (
      SELECT 1 FROM tb_sys_workspace_role_permission binding
      WHERE binding.role_id = role_definition.id
        AND binding.permission_code = permission.permission_code
  );
