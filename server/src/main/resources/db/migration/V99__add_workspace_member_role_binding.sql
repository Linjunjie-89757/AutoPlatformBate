CREATE TABLE IF NOT EXISTS tb_sys_workspace_member_role (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_workspace_member_role
    ON tb_sys_workspace_member_role (member_id, role_id);
CREATE INDEX IF NOT EXISTS idx_workspace_member_role_role
    ON tb_sys_workspace_member_role (role_id);

INSERT INTO tb_sys_workspace_role (
    workspace_id,
    role_code,
    role_name,
    description,
    status,
    created_at,
    updated_at
)
SELECT
    ws.id,
    'SYSTEM_TEST_LEAD',
    '测试负责人',
    '系统内置业务角色，用于标识测试管理职责',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tb_sys_workspace ws
WHERE NOT EXISTS (
    SELECT 1
    FROM tb_sys_workspace_role role_definition
    WHERE role_definition.workspace_id = ws.id
      AND role_definition.role_code = 'SYSTEM_TEST_LEAD'
);

INSERT INTO tb_sys_workspace_role (
    workspace_id,
    role_code,
    role_name,
    description,
    status,
    created_at,
    updated_at
)
SELECT
    ws.id,
    'SYSTEM_TEST_ENGINEER',
    '测试工程师',
    '系统内置业务角色，用于标识测试执行职责',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tb_sys_workspace ws
WHERE NOT EXISTS (
    SELECT 1
    FROM tb_sys_workspace_role role_definition
    WHERE role_definition.workspace_id = ws.id
      AND role_definition.role_code = 'SYSTEM_TEST_ENGINEER'
);

INSERT INTO tb_sys_workspace_member_role (
    member_id,
    role_id,
    created_at,
    updated_at
)
SELECT
    workspace_member.id,
    role_definition.id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tb_sys_workspace_member workspace_member
JOIN tb_sys_workspace_role role_definition
  ON role_definition.workspace_id = workspace_member.workspace_id
 AND role_definition.role_code = CASE
     WHEN UPPER(workspace_member.role_code) = 'ADMIN' THEN 'SYSTEM_TEST_LEAD'
     ELSE 'SYSTEM_TEST_ENGINEER'
 END
WHERE workspace_member.status = 1
  AND NOT EXISTS (
      SELECT 1
      FROM tb_sys_workspace_member_role binding
      WHERE binding.member_id = workspace_member.id
        AND binding.role_id = role_definition.id
  );
