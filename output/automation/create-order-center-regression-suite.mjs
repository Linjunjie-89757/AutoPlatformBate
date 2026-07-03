import { spawnSync } from 'node:child_process';

const mysqlArgs = [
  'exec',
  '-i',
  'auto-platform-mysql',
  'mysql',
  '--default-character-set=utf8mb4',
  '-uauto_user',
  '-pauto123456',
  'auto_platform',
  '-B',
  '-N',
];

const workspaceId = 1;
const envId = 15;
const suiteName = '订单中心-回归套件';
const suiteModuleName = '订单中心';
const description = '由 Codex 生成，覆盖订单中心菜单查询与低风险新增编辑闭环场景。';
const includedDescriptions = [
  '由 Codex 根据订单中心菜单首屏业务请求生成的可重复查询场景。',
  '由 Codex 生成的订单中心低风险新增/编辑闭环场景：自造测试数据、查询提取本次 ID、编辑并查询验证。',
  '由 Codex 根据订单中心低风险新增编辑接口生成的可重复闭环场景。',
];

function mysql(sql) {
  const result = spawnSync('docker', mysqlArgs, {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `mysql exited with ${result.status}`);
  }
  return result.stdout.trim();
}

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function scalar(sql) {
  const output = mysql(sql);
  return output ? output.split(/\r?\n/)[0].split('\t')[0] : '';
}

let moduleId = scalar(`
SELECT id
FROM tb_api_execution_suite_module
WHERE workspace_id = ${workspaceId}
  AND parent_id IS NULL
  AND module_name = ${sqlString(suiteModuleName)}
ORDER BY id
LIMIT 1;
`);

if (!moduleId) {
  mysql(`
INSERT INTO tb_api_execution_suite_module (workspace_id, parent_id, module_name, sort_order)
VALUES (${workspaceId}, NULL, ${sqlString(suiteModuleName)}, 30);
`);
  moduleId = scalar(`
SELECT id
FROM tb_api_execution_suite_module
WHERE workspace_id = ${workspaceId}
  AND parent_id IS NULL
  AND module_name = ${sqlString(suiteModuleName)}
ORDER BY id DESC
LIMIT 1;
`);
}

let suiteId = scalar(`
SELECT id
FROM tb_api_execution_suite
WHERE workspace_id = ${workspaceId}
  AND suite_name = ${sqlString(suiteName)}
ORDER BY id
LIMIT 1;
`);

if (!suiteId) {
  mysql(`
INSERT INTO tb_api_execution_suite (
  workspace_id, module_id, suite_name, priority, status, description,
  environment_id, variable_set_id, run_mode, run_on, notify_enabled,
  continue_on_failure, global_timeout_ms, step_failure_retry_count, default_step_wait_ms,
  schedule_enabled, cron_expression, branch_name, trigger_source, branch_note,
  data_driven_enabled, data_file_id, data_file_name_snapshot, case_desc_column, data_failure_strategy
) VALUES (
  ${workspaceId}, ${moduleId}, ${sqlString(suiteName)}, 'P1', 'ACTIVE', ${sqlString(description)},
  ${envId}, NULL, 'SERIAL', 'SERVER', 0,
  1, 300000, 0, 0,
  0, NULL, NULL, 'CODEX_ORDER_CENTER', NULL,
  0, NULL, NULL, NULL, 'STOP_ON_ROW_FAILURE'
);
`);
  suiteId = scalar(`
SELECT id
FROM tb_api_execution_suite
WHERE workspace_id = ${workspaceId}
  AND suite_name = ${sqlString(suiteName)}
ORDER BY id DESC
LIMIT 1;
`);
} else {
  mysql(`
UPDATE tb_api_execution_suite
SET module_id = ${moduleId},
    description = ${sqlString(description)},
    environment_id = ${envId},
    run_mode = 'SERIAL',
    run_on = 'SERVER',
    notify_enabled = 0,
    continue_on_failure = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ${suiteId};
`);
}

const scenarioRows = mysql(`
SELECT id, scenario_name
FROM tb_api_scenario
WHERE workspace_id = ${workspaceId}
  AND module_id = 3
  AND COALESCE(description, '') IN (${includedDescriptions.map(sqlString).join(',')})
ORDER BY id;
`);

const scenarios = scenarioRows
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [idValue, name] = line.split('\t');
    return { id: Number(idValue), name };
  });

const itemStatements = scenarios.map((scenario, index) => `
INSERT INTO tb_api_execution_suite_item (
  workspace_id, suite_id, item_type, item_id, item_name_snapshot, sort_order, enabled, description
) VALUES (
  ${workspaceId}, ${suiteId}, 'SCENARIO', ${scenario.id}, ${sqlString(scenario.name)}, ${(index + 1) * 10}, 1, NULL
);
`);

mysql(`
START TRANSACTION;
DELETE FROM tb_api_execution_suite_item WHERE workspace_id = ${workspaceId} AND suite_id = 0;
DELETE FROM tb_api_execution_suite_item WHERE workspace_id = ${workspaceId} AND suite_id = ${suiteId};
${itemStatements.join('\n')}
COMMIT;
`);

const summary = mysql(`
SELECT s.id, s.suite_name, s.module_id, COUNT(i.id) AS item_count, s.last_run_result
FROM tb_api_execution_suite s
LEFT JOIN tb_api_execution_suite_item i ON i.suite_id = s.id
WHERE s.id = ${suiteId}
GROUP BY s.id, s.suite_name, s.module_id, s.last_run_result;
`);

console.log(JSON.stringify({ suiteId: Number(suiteId), moduleId: Number(moduleId), itemCount: scenarios.length, summary }, null, 2));
