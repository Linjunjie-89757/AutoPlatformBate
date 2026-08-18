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
    goal CLOB,
    lock_version INT NOT NULL DEFAULT 0,
    archived_at TIMESTAMP NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_test_version_no
    ON tb_test_version (workspace_id, version_no);
CREATE UNIQUE INDEX IF NOT EXISTS uk_test_version_name
    ON tb_test_version (workspace_id, name);
CREATE INDEX IF NOT EXISTS idx_test_version_status
    ON tb_test_version (workspace_id, status, updated_at);

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
    description CLOB,
    lock_version INT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_test_requirement_no
    ON tb_test_requirement (workspace_id, requirement_no);
CREATE INDEX IF NOT EXISTS idx_test_requirement_version
    ON tb_test_requirement (workspace_id, version_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_test_requirement_assignee
    ON tb_test_requirement (workspace_id, assignee_id, updated_at);

CREATE TABLE IF NOT EXISTS tb_test_requirement_case (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    requirement_id BIGINT NOT NULL,
    case_id BIGINT NOT NULL,
    review_status VARCHAR(32) NOT NULL,
    review_note CLOB,
    reviewer_id BIGINT,
    reviewed_at TIMESTAMP NULL,
    case_updated_at_when_reviewed TIMESTAMP NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_test_requirement_case
    ON tb_test_requirement_case (requirement_id, case_id);
CREATE INDEX IF NOT EXISTS idx_test_requirement_case_status
    ON tb_test_requirement_case (workspace_id, requirement_id, review_status);
CREATE INDEX IF NOT EXISTS idx_test_requirement_case_asset
    ON tb_test_requirement_case (workspace_id, case_id);

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
    goal CLOB,
    min_execute_rate DECIMAL(5, 2) NOT NULL DEFAULT 90,
    min_pass_rate DECIMAL(5, 2) NOT NULL DEFAULT 85,
    allow_p0 BOOLEAN NOT NULL DEFAULT FALSE,
    max_p1 INT NOT NULL DEFAULT 3,
    auto_report BOOLEAN NOT NULL DEFAULT TRUE,
    owner_confirm_required BOOLEAN NOT NULL DEFAULT TRUE,
    snapshot_frozen_at TIMESTAMP NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    cancel_reason CLOB,
    lock_version INT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_test_plan_no
    ON tb_test_plan (workspace_id, plan_no);
CREATE INDEX IF NOT EXISTS idx_test_plan_version
    ON tb_test_plan (workspace_id, version_id, status);
CREATE INDEX IF NOT EXISTS idx_test_plan_owner
    ON tb_test_plan (workspace_id, owner_id, updated_at);

CREATE TABLE IF NOT EXISTS tb_test_plan_requirement (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    requirement_id BIGINT NOT NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_test_plan_requirement
    ON tb_test_plan_requirement (plan_id, requirement_id);
CREATE INDEX IF NOT EXISTS idx_test_plan_requirement_req
    ON tb_test_plan_requirement (workspace_id, requirement_id);

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
    snapshot_precondition CLOB,
    snapshot_steps CLOB,
    snapshot_expected_result CLOB,
    source_case_updated_at TIMESTAMP NULL,
    added_after_start BOOLEAN NOT NULL DEFAULT FALSE,
    assignee_id BIGINT,
    execution_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    execution_note CLOB,
    executed_by BIGINT,
    executed_at TIMESTAMP NULL,
    sort_order INT NOT NULL DEFAULT 0,
    lock_version INT NOT NULL DEFAULT 0,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_test_plan_case_source
    ON tb_test_plan_case (plan_id, source_case_id);
CREATE INDEX IF NOT EXISTS idx_test_plan_case_status
    ON tb_test_plan_case (workspace_id, plan_id, execution_status);
CREATE INDEX IF NOT EXISTS idx_test_plan_case_assignee
    ON tb_test_plan_case (workspace_id, assignee_id, execution_status);

CREATE TABLE IF NOT EXISTS tb_test_plan_case_requirement (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    plan_case_id BIGINT NOT NULL,
    requirement_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_test_plan_case_req
    ON tb_test_plan_case_requirement (plan_case_id, requirement_id);
CREATE INDEX IF NOT EXISTS idx_test_plan_case_req_requirement
    ON tb_test_plan_case_requirement (workspace_id, requirement_id);

CREATE TABLE IF NOT EXISTS tb_test_plan_case_execution (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    plan_case_id BIGINT NOT NULL,
    previous_status VARCHAR(32) NOT NULL,
    execution_status VARCHAR(32) NOT NULL,
    execution_note CLOB,
    executor_id BIGINT NOT NULL,
    executed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_test_plan_case_execution
    ON tb_test_plan_case_execution (workspace_id, plan_case_id, executed_at);
CREATE INDEX IF NOT EXISTS idx_test_plan_execution_plan
    ON tb_test_plan_case_execution (workspace_id, plan_id, executed_at);

CREATE TABLE IF NOT EXISTS tb_test_plan_report (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    content_snapshot_json CLOB NOT NULL,
    generated_at TIMESTAMP NOT NULL,
    signed_by BIGINT,
    signed_at TIMESTAMP NULL,
    signature_revoked_by BIGINT,
    signature_revoked_at TIMESTAMP NULL,
    lock_version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_test_plan_report_plan
    ON tb_test_plan_report (plan_id);
CREATE INDEX IF NOT EXISTS idx_test_plan_report_workspace
    ON tb_test_plan_report (workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS tb_test_activity_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id BIGINT NOT NULL,
    action_code VARCHAR(64) NOT NULL,
    action_name VARCHAR(128) NOT NULL,
    detail CLOB,
    actor_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_test_activity_entity
    ON tb_test_activity_log (workspace_id, entity_type, entity_id, created_at);

ALTER TABLE tb_bug_info
    ADD COLUMN IF NOT EXISTS test_version_id BIGINT;
ALTER TABLE tb_bug_info
    ADD COLUMN IF NOT EXISTS test_requirement_id BIGINT;
ALTER TABLE tb_bug_info
    ADD COLUMN IF NOT EXISTS test_plan_id BIGINT;
ALTER TABLE tb_bug_info
    ADD COLUMN IF NOT EXISTS test_plan_case_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_bug_test_version
    ON tb_bug_info (workspace_id, test_version_id, status);
CREATE INDEX IF NOT EXISTS idx_bug_test_plan
    ON tb_bug_info (workspace_id, test_plan_id, status);
CREATE INDEX IF NOT EXISTS idx_bug_test_requirement
    ON tb_bug_info (workspace_id, test_requirement_id, status);

MERGE INTO tb_sys_permission (
    permission_code, module_code, module_name, action_code, action_name, risky, status, sort_order
) KEY (permission_code) VALUES
    ('test_management.view', 'test_management', '测试管理', 'view', '查看', 0, 1, 351),
    ('test_management.create', 'test_management', '测试管理', 'create', '新建', 0, 1, 352),
    ('test_management.edit', 'test_management', '测试管理', 'edit', '编辑', 0, 1, 353),
    ('test_management.delete', 'test_management', '测试管理', 'delete', '删除', 1, 1, 354),
    ('test_management.review', 'test_management', '测试管理', 'review', '评审', 1, 1, 355),
    ('test_management.execute', 'test_management', '测试管理', 'execute', '执行', 0, 1, 356),
    ('test_management.release', 'test_management', '测试管理', 'release', '发布与强制准出', 1, 1, 357),
    ('test_management.export', 'test_management', '测试管理', 'export', '导出', 0, 1, 358);

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
