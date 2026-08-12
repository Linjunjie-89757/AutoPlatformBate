CREATE TABLE IF NOT EXISTS tb_sys_permission (
    permission_code VARCHAR(64) PRIMARY KEY,
    module_code VARCHAR(32) NOT NULL,
    module_name VARCHAR(64) NOT NULL,
    action_code VARCHAR(32) NOT NULL,
    action_name VARCHAR(32) NOT NULL,
    risky INT NOT NULL DEFAULT 0,
    status INT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_permission_module (module_code, sort_order)
);

CREATE TABLE IF NOT EXISTS tb_sys_workspace_role_permission (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_id BIGINT NOT NULL,
    permission_code VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_workspace_role_permission (role_id, permission_code),
    KEY idx_workspace_role_permission_code (permission_code)
);

INSERT INTO tb_sys_permission (
    permission_code, module_code, module_name, action_code, action_name, risky, status, sort_order
) VALUES
    ('cases.view', 'cases', '用例中心', 'view', '查看', 0, 1, 101),
    ('cases.create', 'cases', '用例中心', 'create', '新建', 0, 1, 102),
    ('cases.edit', 'cases', '用例中心', 'edit', '编辑', 0, 1, 103),
    ('cases.delete', 'cases', '用例中心', 'delete', '删除', 1, 1, 104),
    ('cases.execute', 'cases', '用例中心', 'execute', '执行', 0, 1, 105),
    ('cases.export', 'cases', '用例中心', 'export', '导出', 0, 1, 106),
    ('api.view', 'api', '接口自动化', 'view', '查看', 0, 1, 201),
    ('api.create', 'api', '接口自动化', 'create', '新建', 0, 1, 202),
    ('api.edit', 'api', '接口自动化', 'edit', '编辑', 0, 1, 203),
    ('api.delete', 'api', '接口自动化', 'delete', '删除', 1, 1, 204),
    ('api.execute', 'api', '接口自动化', 'execute', '执行', 0, 1, 205),
    ('api.export', 'api', '接口自动化', 'export', '导出', 0, 1, 206),
    ('webui.view', 'webui', 'Web UI 自动化', 'view', '查看', 0, 1, 301),
    ('webui.create', 'webui', 'Web UI 自动化', 'create', '新建', 0, 1, 302),
    ('webui.edit', 'webui', 'Web UI 自动化', 'edit', '编辑', 0, 1, 303),
    ('webui.delete', 'webui', 'Web UI 自动化', 'delete', '删除', 1, 1, 304),
    ('webui.execute', 'webui', 'Web UI 自动化', 'execute', '执行', 0, 1, 305),
    ('bugs.view', 'bugs', '缺陷管理', 'view', '查看', 0, 1, 401),
    ('bugs.create', 'bugs', '缺陷管理', 'create', '新建', 0, 1, 402),
    ('bugs.edit', 'bugs', '缺陷管理', 'edit', '编辑', 0, 1, 403),
    ('bugs.delete', 'bugs', '缺陷管理', 'delete', '删除', 1, 1, 404),
    ('bugs.review', 'bugs', '缺陷管理', 'review', '审核', 1, 1, 405),
    ('config.view', 'config', '配置中心', 'view', '查看', 0, 1, 501),
    ('config.manage', 'config', '配置中心', 'manage', '配置', 1, 1, 502),
    ('reports.view', 'reports', '报告中心', 'view', '查看', 0, 1, 601),
    ('reports.edit', 'reports', '报告中心', 'edit', '编辑', 0, 1, 602),
    ('reports.delete', 'reports', '报告中心', 'delete', '删除', 1, 1, 603),
    ('reports.export', 'reports', '报告中心', 'export', '导出', 0, 1, 604),
    ('reports.share', 'reports', '报告中心', 'share', '分享', 1, 1, 605),
    ('tasks.view', 'tasks', '任务中心', 'view', '查看', 0, 1, 701),
    ('tasks.create', 'tasks', '任务中心', 'create', '新建', 0, 1, 702),
    ('tasks.edit', 'tasks', '任务中心', 'edit', '编辑', 0, 1, 703),
    ('tasks.delete', 'tasks', '任务中心', 'delete', '删除', 1, 1, 704),
    ('tasks.execute', 'tasks', '任务中心', 'execute', '执行', 0, 1, 705)
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
JOIN tb_sys_permission permission ON permission.status = 1
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
      'cases.view', 'cases.create', 'cases.edit', 'cases.execute', 'cases.export',
      'api.view', 'api.create', 'api.edit', 'api.execute', 'api.export',
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
