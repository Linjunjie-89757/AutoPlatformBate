import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
const moduleId = 4;
const defaultEnvId = 15;
const loginScenarioId = 3;
const directoryName = '获客中心';
const codexDescription = '由 Codex 根据获客中心菜单首屏业务请求生成的可重复只读查询场景。';
const scanPath = new URL('./customer-center/menu-scan-results.json', `file://${dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/')}/`);

const includedMenus = new Map([
  ['全部订单', '全部订单'],
  ['快速查询', '快速查询'],
  ['退款列表', '退款列表'],
  ['分配计划', '分配计划'],
  ['主播管理', '主播管理'],
  ['平台分类', '平台分类'],
  ['部门分类', '部门分类'],
  ['产品管理', '产品管理'],
  ['页面管理', '页面管理'],
  ['回传配置', '回传配置'],
  ['小程序管理', '小程序管理'],
  ['链接分析', '链接分析'],
  ['产品分析', '产品分析'],
  ['黑名单管理', '黑名单管理'],
  ['白名单管理', '白名单管理'],
  ['广告主设置', '广告主设置'],
  ['上传中心 0', '上传中心'],
  ['下载中心', '下载中心'],
]);

const includedDictTypes = new Set([
  'operation_tag',
  'market_office',
  'traffic_black_list_type',
  'traffic_developer_type',
]);

const codeOnlyProbePaths = new Set([
  '/traffic-admin/admin/v1/original-traffic-order/search',
]);

function mysql(sql) {
  const result = spawnSync('docker', mysqlArgs, {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 40,
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

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function param(overrides = {}) {
  return {
    key: '',
    value: '',
    description: '',
    enabled: true,
    paramType: '',
    required: false,
    encode: false,
    minLength: null,
    maxLength: null,
    fileName: '',
    contentType: '',
    fileBase64: '',
    ...overrides,
  };
}

function assertionCode() {
  return {
    type: null,
    subject: null,
    operator: null,
    expectedValue: '200',
    id: uid('assertion-response_code'),
    assertionType: 'RESPONSE_CODE',
    name: '状态码',
    enabled: true,
    description: null,
    condition: 'EQUALS',
    assertions: null,
    assertionBodyType: null,
    jsonPathAssertion: null,
    xpathAssertion: null,
    regexAssertion: null,
    variableAssertionItems: null,
    scriptLanguage: null,
    script: null,
  };
}

function assertionBody(extra = []) {
  return {
    type: 'RESPONSE_BODY',
    subject: null,
    operator: null,
    expectedValue: null,
    id: uid('assertion-response_body'),
    assertionType: 'RESPONSE_BODY',
    name: '响应体',
    enabled: true,
    description: null,
    condition: null,
    assertions: null,
    assertionBodyType: 'JSON_PATH',
    jsonPathAssertion: {
      assertions: [
        { header: null, expression: '$.msg', variableName: null, condition: 'EQUALS', expectedValue: 'success', enabled: null },
        ...extra,
      ],
      responseFormat: 'XML',
    },
    xpathAssertion: {
      assertions: [{ header: null, expression: '/root', variableName: null, condition: 'EQUALS', expectedValue: '', enabled: null }],
      responseFormat: 'XML',
    },
    regexAssertion: {
      assertions: [{ header: null, expression: '.+', variableName: null, condition: 'EQUALS', expectedValue: '', enabled: null }],
      responseFormat: 'XML',
    },
    variableAssertionItems: null,
    scriptLanguage: null,
    script: null,
  };
}

function requestConfig(method, path, queryParams = [], body = null) {
  const isGet = method === 'GET';
  return {
    method,
    path,
    timeoutMs: 10000,
    queryParams,
    headers: [param({ key: 'access-token', value: '{{access-token}}' }), param()],
    cookies: [],
    body: isGet
      ? { type: 'NONE', rawText: null, formItems: [], contentType: null, fileName: null, binaryBase64: null }
      : {
          type: 'RAW_JSON',
          rawText: JSON.stringify(body ?? {}, null, 2),
          formItems: [],
          contentType: 'application/json',
          fileName: null,
          binaryBase64: null,
        },
    authConfig: {
      authType: 'NONE',
      basicAuth: { userName: '', password: '' },
      digestAuth: { userName: '', password: '' },
    },
    schemaFields: [],
  };
}

function ensureDefinition({ name, method, path, queryParams, body = null }) {
  let id = scalar(`
SELECT id
FROM tb_api_definition
WHERE workspace_id = ${workspaceId}
  AND http_method = ${sqlString(method)}
  AND path = ${sqlString(path)}
ORDER BY id
LIMIT 1;
`);
  if (id) return Number(id);

  const requestJson = JSON.stringify(requestConfig(method, path, queryParams, body));
  mysql(`
INSERT INTO tb_api_definition (
  workspace_id, definition_name, http_method, path, directory_name, description,
  tags_json, request_json, assertions_json, extractors_json, preprocessors_json, postprocessors_json
) VALUES (
  ${workspaceId}, ${sqlString(name)}, ${sqlString(method)}, ${sqlString(path)}, ${sqlString(directoryName)}, ${sqlString('由 Codex 为获客中心查询场景补充的接口定义。')},
  ${sqlString(JSON.stringify([directoryName, 'Codex生成']))}, ${sqlString(requestJson)}, '[]', '[]', '[]', '[]'
);
`);
  id = scalar(`
SELECT id
FROM tb_api_definition
WHERE workspace_id = ${workspaceId}
  AND http_method = ${sqlString(method)}
  AND path = ${sqlString(path)}
ORDER BY id DESC
LIMIT 1;
`);
  return Number(id);
}

function stepBase(overrides) {
  return {
    id: uid('draft-step'),
    enabled: true,
    requestConfig: null,
    assertions: [],
    preProcessors: [],
    postProcessors: [],
    delayMs: 1,
    conditionType: 'EXPRESSION',
    conditionExpression: null,
    loopType: 'FIXED',
    loopCount: 1,
    foreachExpression: null,
    script: '',
    children: [],
    ...overrides,
  };
}

function loginStep() {
  return stepBase({
    stepName: '登录',
    stepType: 'API_SCENARIO',
    refType: 'REF',
    resourceType: null,
    resourceId: loginScenarioId,
  });
}

function apiStep(request) {
  return stepBase({
    stepName: request.name,
    stepType: 'API',
    refType: 'COPY',
    resourceType: 'DEFINITION',
    resourceId: request.resourceId,
    requestConfig: requestConfig(request.method, request.path, request.queryParams, request.body),
    assertions: request.codeOnly ? [assertionCode()] : [assertionCode(), assertionBody()],
  });
}

function parseBody(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function parseRequest(rawRequest) {
  const url = new URL(rawRequest.url);
  const method = rawRequest.method;
  const queryParams = Array.from(url.searchParams.entries()).map(([key, value]) => param({ key, value }));
  const body = method === 'GET' ? null : parseBody(rawRequest.postData);
  return { method, path: url.pathname, queryParams, body, host: url.host, status: rawRequest.status };
}

function shouldIncludeRequest(menu, parsedRequest) {
  if (parsedRequest.host !== 'japi-test.integrity.com.cn') return false;
  if (!['GET', 'POST'].includes(parsedRequest.method)) return false;
  if (codeOnlyProbePaths.has(parsedRequest.path)) return true;
  if (parsedRequest.status !== 200) return false;

  if (parsedRequest.path === '/system-management/admin/system/dictData/list') {
    const dictType = parsedRequest.body?.dictType;
    return includedDictTypes.has(dictType);
  }

  return true;
}

function dictStepName(menuName, body) {
  const names = {
    operation_tag: '运营标签字典',
    market_office: '投放部门字典',
    traffic_black_list_type: '黑名单类型字典',
    traffic_developer_type: '白名单开发者类型字典',
  };
  return `${menuName} - ${names[body?.dictType] || '字典查询'}`;
}

function stepName(menuName, request) {
  if (request.path === '/system-management/admin/system/dictData/list') return dictStepName(menuName, request.body);

  const names = {
    '/traffic-admin/admin/v1/organization/search': '组织搜索',
    '/traffic-admin/admin/v1/order-assign-plan/view-list': '分配计划列表',
    '/traffic-admin/admin/v1/source-channel/view-list': '渠道列表',
    '/traffic-admin/admin/v1/original-traffic-order/search': '订单列表查询报错探针',
    '/traffic-admin/admin/v1/original-traffic-order/quick-search': '快速查询',
    '/traffic-admin/admin/v1/commodity/search': '产品搜索',
    '/traffic-admin/admin/v1/traffic-order-refund/reviewStatusGroupCount': '退款审核状态统计',
    '/traffic-admin/admin/v1/traffic-order-refund/search': '退款列表查询',
    '/traffic-admin/admin/v1/live-streamer/view-list': '主播列表',
    '/traffic-admin/admin/v1/organization-team/view-list': '团队列表',
    '/traffic-admin/admin/v1/organization-team/search': '团队搜索',
    '/traffic-admin/admin/v1/stream-platform/view-list': '平台分类列表',
    '/traffic-admin/admin/v1/organization/view-list': '部门列表',
    '/traffic-admin/admin/v1/market-page/search': '页面搜索',
    '/traffic-admin/admin/v1/stream-platform/search': '平台搜索',
    '/traffic-admin/admin/v1/mini-app/search': '小程序搜索',
    '/traffic-admin/admin/v1/commodity/view-list': '产品列表',
    '/traffic-admin/admin/v1/market-page/view-list': '页面列表',
    '/traffic-admin/admin/v1/target-page-callback/view-list': '回传配置列表',
    '/traffic-admin/admin/v1/mini-app/view-list': '小程序列表',
    '/user-stat/admin/v1/stat-param-item/find-list': '统计参数列表',
    '/user-stat/admin/v1/user-cvr-sum/sum-data': '链接转化汇总',
    '/user-stat/admin/v1/user-cvr-stat/search': '链接转化明细',
    '/user-stat/admin/v1/user-cvr-sum/sum-overview': '链接转化概览',
    '/user-stat/admin/v1/user-cvr-sum/cvr-trend-date': '链接转化趋势',
    '/data-analysis/pub/authorization/userField/detail': '字段授权详情',
    '/data-analysis/admin/report/userAcquisition/stat': '获客产品统计',
    '/traffic-admin/admin/v1/black-list-user/search': '黑名单查询',
    '/traffic-admin/admin/v1/developer/view-list': '白名单列表',
    '/traffic-admin/admin/v1/ad-advertiser/search': '广告主查询',
    '/risk-management/admin/liveupload/list': '上传列表',
    '/traffic-admin/admin/v1/ad-creative/search': '创意查询',
    '/download-center/admin/v1/downloadTask/list': '下载任务列表',
  };

  return `${menuName} - ${names[request.path] || request.path.split('/').filter(Boolean).slice(-2).join('/')}`;
}

function buildScenarios() {
  const scanResults = JSON.parse(readFileSync(scanPath, 'utf8'));
  return scanResults
    .filter((item) => includedMenus.has(item.menu))
    .map((item) => {
      const scenarioName = includedMenus.get(item.menu);
      const requests = (item.requests || [])
        .map(parseRequest)
        .filter((request) => shouldIncludeRequest(item.menu, request))
        .map((request) => ({
          ...request,
          codeOnly: codeOnlyProbePaths.has(request.path),
          name: stepName(scenarioName, request),
          resourceId: ensureDefinition({
            name: stepName(scenarioName, request),
            method: request.method,
            path: request.path,
            queryParams: request.queryParams,
            body: request.body,
          }),
        }));
      return { name: scenarioName, requests };
    })
    .filter((scenario) => scenario.requests.length > 0);
}

const scenarios = buildScenarios();
const existingOutput = mysql(`
SELECT id, scenario_name, COALESCE(description, '')
FROM tb_api_scenario
WHERE workspace_id = ${workspaceId}
  AND module_id = ${moduleId}
  AND scenario_name IN (${scenarios.map((item) => sqlString(item.name)).join(',')});
`);
const existing = new Map(
  existingOutput
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [idValue, name, description] = line.split('\t');
      return [name, { id: Number(idValue), description }];
    }),
);

const statements = [];
const created = [];
const updated = [];
const skipped = [];

for (const scenario of scenarios) {
  const found = existing.get(scenario.name);
  if (found && found.description !== codexDescription) {
    skipped.push(`${scenario.name}: existing non-Codex scenario`);
    continue;
  }

  const steps = [loginStep(), ...scenario.requests.map(apiStep)];
  const stepsJson = JSON.stringify(steps);
  const tagsJson = JSON.stringify([directoryName, '菜单查询', 'Codex生成']);
  if (found) {
    statements.push(`
UPDATE tb_api_scenario
SET steps_json = ${sqlString(stepsJson)},
    tags_json = ${sqlString(tagsJson)},
    default_env_id = ${defaultEnvId},
    description = ${sqlString(codexDescription)},
    updated_at = CURRENT_TIMESTAMP
WHERE id = ${found.id};
`);
    updated.push(`${found.id}:${scenario.name}`);
  } else {
    statements.push(`
INSERT INTO tb_api_scenario (
  workspace_id, scenario_name, directory_name, description, tags_json, steps_json,
  default_env_id, variable_set_id, continue_on_failure, related_case_id, module_id,
  priority, status, scenario_assertions_json, scenario_variables_json,
  global_timeout_ms, step_failure_retry_count, default_step_wait_ms,
  data_driven_enabled, data_file_id, data_file_name_snapshot, case_desc_column, data_failure_strategy
) VALUES (
  ${workspaceId}, ${sqlString(scenario.name)}, NULL, ${sqlString(codexDescription)},
  ${sqlString(tagsJson)}, ${sqlString(stepsJson)}, ${defaultEnvId}, NULL, 1, NULL, ${moduleId},
  'P1', 'IN_PROGRESS', '[]', '[]', 300000, 0, 0, 0, NULL, NULL, NULL, 'STOP_ON_ROW_FAILURE'
);
`);
    created.push(scenario.name);
  }
}

if (statements.length) {
  mysql(`START TRANSACTION;\n${statements.join('\n')}\nCOMMIT;`);
}

const result = mysql(`
SELECT id, scenario_name, JSON_LENGTH(steps_json) AS step_count, last_run_result
FROM tb_api_scenario
WHERE workspace_id = ${workspaceId}
  AND module_id = ${moduleId}
ORDER BY id;
`);

console.log(JSON.stringify({ created, updated, skipped, result }, null, 2));
