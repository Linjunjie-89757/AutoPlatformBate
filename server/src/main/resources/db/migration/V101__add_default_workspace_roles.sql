UPDATE tb_sys_workspace_role
SET role_name = '项目负责人',
    description = '负责测试团队管理、权限配置和报告审核',
    updated_at = CURRENT_TIMESTAMP
WHERE role_code = 'SYSTEM_TEST_LEAD';

UPDATE tb_sys_workspace_role
SET role_name = '测试工程师',
    description = '负责用例编写、自动化脚本开发和执行',
    updated_at = CURRENT_TIMESTAMP
WHERE role_code = 'SYSTEM_TEST_ENGINEER';

INSERT INTO tb_sys_workspace_role (
    workspace_id, role_code, role_name, description, status, created_at, updated_at
)
SELECT
    ws.id, 'SYSTEM_DEVELOPER', '开发人员', '只读查看用例和缺陷，协助联调', 1,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM tb_sys_workspace ws
WHERE NOT EXISTS (
    SELECT 1 FROM tb_sys_workspace_role role_definition
    WHERE role_definition.workspace_id = ws.id
      AND role_definition.role_code = 'SYSTEM_DEVELOPER'
);

INSERT INTO tb_sys_workspace_role (
    workspace_id, role_code, role_name, description, status, created_at, updated_at
)
SELECT
    ws.id, 'SYSTEM_READ_ONLY', '只读访客', '仅可查看报告和用例，不可操作', 1,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM tb_sys_workspace ws
WHERE NOT EXISTS (
    SELECT 1 FROM tb_sys_workspace_role role_definition
    WHERE role_definition.workspace_id = ws.id
      AND role_definition.role_code = 'SYSTEM_READ_ONLY'
);

DELETE FROM tb_sys_workspace_role_permission
WHERE role_id IN (
    SELECT id FROM tb_sys_workspace_role WHERE role_code = 'SYSTEM_TEST_ENGINEER'
)
AND permission_code NOT IN (
    'cases.view', 'cases.create', 'cases.edit', 'cases.execute',
    'api.view', 'api.create', 'api.edit', 'api.execute',
    'webui.view', 'webui.create', 'webui.edit', 'webui.execute',
    'bugs.view', 'bugs.create', 'bugs.edit',
    'config.view',
    'reports.view', 'reports.export',
    'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.execute'
);

INSERT INTO tb_sys_workspace_role_permission (role_id, permission_code, created_at, updated_at)
SELECT role_definition.id, permission.permission_code, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM tb_sys_workspace_role role_definition
JOIN tb_sys_permission permission
  ON permission.permission_code IN (
      'cases.view', 'cases.create', 'cases.edit', 'cases.execute',
      'api.view', 'api.create', 'api.edit', 'api.execute',
      'webui.view', 'webui.create', 'webui.edit', 'webui.execute',
      'bugs.view', 'bugs.create', 'bugs.edit',
      'config.view',
      'reports.view', 'reports.export',
      'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.execute'
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
JOIN tb_sys_permission permission
  ON permission.permission_code IN (
      'cases.view', 'api.view', 'api.execute', 'webui.view',
      'bugs.view', 'bugs.edit', 'reports.view', 'tasks.view'
  )
WHERE role_definition.role_code = 'SYSTEM_DEVELOPER'
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
      'cases.view', 'api.view', 'webui.view', 'reports.view'
  )
WHERE role_definition.role_code = 'SYSTEM_READ_ONLY'
  AND NOT EXISTS (
      SELECT 1 FROM tb_sys_workspace_role_permission binding
      WHERE binding.role_id = role_definition.id
        AND binding.permission_code = permission.permission_code
  );
