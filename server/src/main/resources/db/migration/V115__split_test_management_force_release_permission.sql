UPDATE tb_sys_permission
SET action_name = '发布', updated_at = CURRENT_TIMESTAMP
WHERE permission_code = 'test_management.release';

MERGE INTO tb_sys_permission (
    permission_code, module_code, module_name, action_code, action_name, risky, status, sort_order
) KEY (permission_code) VALUES
    ('test_management.force_release', 'test_management', '测试管理', 'force_release', '强制发布', 1, 1, 358);

UPDATE tb_sys_permission
SET sort_order = 359, updated_at = CURRENT_TIMESTAMP
WHERE permission_code = 'test_management.export';

INSERT INTO tb_sys_workspace_role_permission (role_id, permission_code, created_at, updated_at)
SELECT role_definition.id, 'test_management.force_release', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM tb_sys_workspace_role role_definition
WHERE role_definition.role_code = 'SYSTEM_TEST_LEAD'
  AND NOT EXISTS (
      SELECT 1 FROM tb_sys_workspace_role_permission binding
      WHERE binding.role_id = role_definition.id
        AND binding.permission_code = 'test_management.force_release'
  );
