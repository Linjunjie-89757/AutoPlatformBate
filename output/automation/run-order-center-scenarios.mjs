import { spawnSync } from 'node:child_process';

const platformBaseUrl = 'http://localhost:8080/api';
const args = process.argv.slice(2);
const suiteMode = args[0] === '--suite';
const scenarioIds = (suiteMode ? args.slice(1) : args).map(Number).filter(Number.isFinite);

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

async function request(path, options = {}) {
  const response = await fetch(`${platformBaseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${text.slice(0, 1000)}`);
  }
  return { response, body };
}

function cookieFrom(response) {
  const getSetCookie = response.headers.getSetCookie?.();
  const values = getSetCookie?.length ? getSetCookie : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map((item) => item.split(';')[0]).join('; ');
}

async function login() {
  const { response, body } = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'zhangli', password: '123456' }),
  });
  const cookie = cookieFrom(response);
  if (!cookie) throw new Error(`missing login cookie: ${JSON.stringify(body)}`);
  return cookie;
}

async function runScenario(cookie, id) {
  const { body } = await request(`/automation/api/scenarios/${id}/run`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie,
      'X-Workspace-Code': 'account-open',
    },
    body: JSON.stringify({
      environmentId: 15,
      runOn: 'SERVER',
      triggerSource: 'CODEX_ORDER_CENTER',
    }),
  });
  return body;
}

async function runSuite(cookie, id) {
  const { body } = await request(`/automation/api/execution-suites/${id}/run`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie,
      'X-Workspace-Code': 'account-open',
    },
    body: JSON.stringify({
      environmentId: 15,
      runOn: 'SERVER',
      triggerSource: 'CODEX_ORDER_CENTER_SUITE',
    }),
  });
  return body;
}

async function main() {
  const ids = scenarioIds.length ? scenarioIds : mysql(`
SELECT id
FROM tb_api_scenario
WHERE workspace_id = 1
  AND module_id = 3
  AND scenario_name IN ('商品规格-新增编辑闭环','商品活动-新增下架编辑闭环','风控设置-问卷新增编辑闭环')
ORDER BY id;
`).split(/\r?\n/).filter(Boolean).map(Number);

  const cookie = await login();
  if (suiteMode) {
    const id = ids[0];
    const body = await runSuite(cookie, id);
    console.log(JSON.stringify({ id, body }, null, 2));
    const status = mysql(`
SELECT id, suite_name, last_run_result, DATE_FORMAT(last_run_at, '%Y-%m-%d %H:%i:%s') AS last_run_at
FROM tb_api_execution_suite
WHERE id = ${id};
`);
    console.log(status);
    return;
  }

  const runs = [];
  for (const id of ids) {
    const body = await runScenario(cookie, id);
    runs.push({ id, body });
    console.log(JSON.stringify({ id, body }, null, 2));
  }

  const status = mysql(`
SELECT id, scenario_name, last_run_result, DATE_FORMAT(last_run_at, '%Y-%m-%d %H:%i:%s') AS last_run_at
FROM tb_api_scenario
WHERE id IN (${ids.join(',')})
ORDER BY id;
`);
  console.log(status);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
