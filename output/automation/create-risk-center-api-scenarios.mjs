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
const moduleId = 6;
const defaultEnvId = 15;
const loginScenarioId = 3;
const codexDescription = '由 Codex 根据风控中心菜单首屏业务请求生成的可重复只读查询场景。';

function mysql(sql) {
  const result = spawnSync('docker', mysqlArgs, {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 30,
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

function requestConfig(method, path, body = null) {
  const isGet = method === 'GET';
  return {
    method,
    path,
    timeoutMs: 10000,
    queryParams: [],
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

function ensureDefinition({ name, method, path, body = null }) {
  let id = scalar(`
SELECT id
FROM tb_api_definition
WHERE workspace_id = ${workspaceId}
  AND path = ${sqlString(path)}
ORDER BY id
LIMIT 1;
`);
  if (id) return Number(id);

  const requestJson = JSON.stringify(requestConfig(method, path, body));
  mysql(`
INSERT INTO tb_api_definition (
  workspace_id, definition_name, http_method, path, directory_name, description,
  tags_json, request_json, assertions_json, extractors_json, preprocessors_json, postprocessors_json
) VALUES (
  ${workspaceId}, ${sqlString(name)}, ${sqlString(method)}, ${sqlString(path)}, ${sqlString('风控中心')}, ${sqlString('由 Codex 为风控中心查询场景补充的接口定义。')},
  ${sqlString(JSON.stringify(['风控中心', 'Codex生成']))}, ${sqlString(requestJson)}, '[]', '[]', '[]', '[]'
);
`);
  id = scalar(`
SELECT id
FROM tb_api_definition
WHERE workspace_id = ${workspaceId}
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
  const hasDefinition = Number.isInteger(request.resourceId);
  return stepBase({
    stepName: request.name,
    stepType: 'API',
    refType: hasDefinition ? 'COPY' : 'DIRECT',
    resourceType: hasDefinition ? 'DEFINITION' : null,
    resourceId: hasDefinition ? request.resourceId : null,
    requestConfig: requestConfig(request.method, request.path, request.body),
    assertions: [assertionCode(), assertionBody(request.assertions || [])],
  });
}

const commonPage = { pageIndex: 1, pageSize: 10 };
const statStart = 1780416000000;
const statEnd = 1783007999999;
const downloadTaskListDefinitionId = ensureDefinition({
  name: '下载中心 - 下载任务列表',
  method: 'POST',
  path: '/download-center/admin/v1/downloadTask/list',
  body: { ...commonPage, createBy: '', createByDeptCode: '' },
});

const scenarios = [
  {
    name: '账号信息',
    requests: [
      {
        name: '账号信息 - 账号主播信息列表',
        resourceId: 1405,
        method: 'POST',
        path: '/risk-management/admin/risk/accountLiveStreamer/list',
        body: { ...commonPage, nickname: '', status: '', liveStreamerName: '', accountStatus: '', platform: '' },
      },
    ],
  },
  {
    name: '直播报备',
    requests: [
      { name: '直播报备 - 待上传视频数', resourceId: 1445, method: 'GET', path: '/risk-management/admin/risk/liveReport/need-upload/count' },
      {
        name: '直播报备 - 直播信息列表',
        resourceId: 1380,
        method: 'POST',
        path: '/risk-management/admin/risk/liveReport/list',
        body: {
          ...commonPage,
          liveTitle: '',
          platform: '',
          nickname: '',
          liveStreamerType: 1,
          auditingStatus: '',
          havaHistories: '',
          liveStreamerName: '',
          aiAuditStatus: '',
          time: '',
          livePlanTimeStart: '',
          livePlanTimeEnd: '',
          needUpload: '',
        },
      },
    ],
  },
  {
    name: '直播监控',
    requests: [
      { name: '直播监控 - 正在直播主播数', resourceId: 1464, method: 'GET', path: '/risk-management/admin/live-history/living-count' },
      { name: '直播监控 - 意图列表', resourceId: 1460, method: 'GET', path: '/risk-management/admin/risk/Live-inspection/intentList/1' },
      {
        name: '直播监控 - 违规内容列表',
        resourceId: 1413,
        method: 'POST',
        path: '/risk-management/admin/risk/Live-inspection/findPage',
        body: { ...commonPage, historyId: '', auditingStatus: 0, violationType: '' },
      },
      {
        name: '直播监控 - 直播监控列表',
        resourceId: 1421,
        method: 'POST',
        path: '/risk-management/admin/live-history/view-list',
        body: { ...commonPage, totalPage: 1, platform: [] },
      },
    ],
  },
  {
    name: '直播巡检',
    requests: [
      {
        name: '直播巡检 - 主播下拉列表',
        resourceId: 1405,
        method: 'POST',
        path: '/risk-management/admin/risk/accountLiveStreamer/list',
        body: { nickname: '', pageSize: 999 },
      },
      {
        name: '直播巡检 - 直播报备列表',
        resourceId: 1380,
        method: 'POST',
        path: '/risk-management/admin/risk/liveReport/list',
        body: { liveStreamerType: 1 },
      },
      {
        name: '直播巡检 - 违规内容分页查询',
        resourceId: 1412,
        method: 'POST',
        path: '/risk-management/admin/risk/Live-inspection/page',
        body: {
          ...commonPage,
          time: '',
          livePlanStartTime: '',
          livePlanEndTime: '',
          accountCode: '',
          platform: [],
          liveReportId: '',
          existInspection: '',
          liveStreamerType: 1,
        },
      },
    ],
  },
  {
    name: '风控统计',
    requests: [
      {
        name: '风控统计 - 违规内容统计',
        resourceId: 1410,
        method: 'POST',
        path: '/risk-management/admin/risk/Live-inspection/stat',
        body: { livePlanStartTime: statStart, livePlanEndTime: statEnd, accountCode: '', liveStreamerType: 1 },
      },
      {
        name: '风控统计 - 时间维度统计',
        resourceId: 1408,
        method: 'POST',
        path: '/risk-management/admin/risk/Live-inspection/timeDimensionStat',
        body: { livePlanStartTime: statStart, livePlanEndTime: statEnd, accountCode: '', liveStreamerType: 1 },
      },
      {
        name: '风控统计 - 时间维度列表',
        resourceId: 1409,
        method: 'POST',
        path: '/risk-management/admin/risk/Live-inspection/timeDimensionList',
        body: {
          ...commonPage,
          time: [statStart, statEnd],
          livePlanStartTime: statStart,
          livePlanEndTime: statEnd,
          accountCode: '',
          liveStreamerType: 1,
        },
      },
    ],
  },
  {
    name: '讲师信息',
    requests: [
      {
        name: '讲师信息 - 私域主播分页查询',
        resourceId: 1376,
        method: 'POST',
        path: '/risk-management/admin/risk/privateLiveStreamer/queryPage',
        body: { ...commonPage, userName: '', officeCode: '', officeCodeLabel: '' },
      },
    ],
  },
  {
    name: '文字质检',
    requests: [
      {
        name: '文字质检 - 聊天室查询',
        resourceId: 1398,
        method: 'POST',
        path: '/risk-management/admin/risk/chatroom/search',
        body: { ...commonPage, chatroomName: '', userName: '' },
      },
    ],
  },
  {
    name: '订单质检',
    requests: [
      {
        name: '订单质检 - 订单质检结果',
        resourceId: 482,
        method: 'POST',
        path: '/order-admin/admin/riskManagement/orderInspection/search',
        body: {
          ...commonPage,
          startDate: '',
          endDate: '',
          deptCode: '',
          responsibleUserCode: '',
          assigned: '',
          reviewStatus: '',
          inspectionType: 2,
          autoInspectionPass: '',
          manualInspectionResult: '',
          orderId: '',
        },
      },
      {
        name: '订单质检 - 查询页统计',
        resourceId: 483,
        method: 'POST',
        path: '/order-admin/admin/riskManagement/orderInspection/searchStats',
        body: { startDate: '', endDate: '', deptCode: '', responsibleUserCode: '', assigned: '', reviewStatus: '' },
      },
    ],
  },
  {
    name: '订单统计',
    requests: [
      {
        name: '订单统计 - 指标卡片',
        resourceId: 480,
        method: 'POST',
        path: '/order-admin/admin/riskManagement/orderInspection/topCard',
        body: { startDate: statStart, endDate: statEnd, deptCode: '' },
      },
      {
        name: '订单统计 - 图表',
        resourceId: 485,
        method: 'POST',
        path: '/order-admin/admin/riskManagement/orderInspection/chart',
        body: { startDate: statStart, endDate: statEnd, deptCode: '' },
      },
      {
        name: '订单统计 - 统计分页',
        resourceId: 481,
        method: 'POST',
        path: '/order-admin/admin/riskManagement/orderInspection/statsPage',
        body: {
          ...commonPage,
          time: [statStart, statEnd],
          startDate: statStart,
          endDate: statEnd,
          deptCode: '',
          deptCodeLabel: '',
          responsibleUserCode: '',
          assigned: '',
          reviewStatus: '',
          assignTime: '',
          assignTimeStart: '',
          assignTimeEnd: '',
          manualInspectionTime: '',
          manualInspectionTimeStart: '',
          manualInspectionTimeEnd: '',
        },
      },
    ],
  },
  {
    name: '电话质检',
    requests: [
      {
        name: '电话质检 - 通话记录查询',
        resourceId: 488,
        method: 'POST',
        path: '/order-admin/admin/riskManagement/callRecord/search',
        body: { ...commonPage, orderId: '', msgId: '' },
      },
    ],
  },
  {
    name: '投诉复盘',
    requests: [
      { name: '投诉复盘 - 投诉分页查询', resourceId: 1392, method: 'POST', path: '/risk-management/admin/risk/complaint/search', body: { pageIndex: 1, pageSize: 20 } },
      { name: '投诉复盘 - 投诉统计查询', resourceId: 1391, method: 'POST', path: '/risk-management/admin/risk/complaint/stats', body: { pageIndex: 1, pageSize: 20 } },
    ],
  },
  {
    name: '退前告知',
    requests: [
      { name: '退前告知 - 列表查询', resourceId: 1374, method: 'POST', path: '/risk-management/admin/risk/refundNotice/search', body: { ...commonPage } },
    ],
  },
  {
    name: '自媒体台账',
    requests: [
      {
        name: '自媒体台账 - 媒体账号分页查询',
        resourceId: 702,
        method: 'POST',
        path: '/system-management/admin/dam/mediaAccount/page',
        body: { ...commonPage, platformCode: '', nickname: '', realNameUserCode: '', enabled: '' },
      },
    ],
  },
  {
    name: '员工挂证',
    requests: [
      { name: '员工挂证 - 职位字典', resourceId: 632, method: 'POST', path: '/system-management/admin/system/dictData/list', body: { dictType: 'employee_position', enabled: '1' } },
      { name: '员工挂证 - 岗位类别字典', resourceId: 632, method: 'POST', path: '/system-management/admin/system/dictData/list', body: { dictType: 'employee_job_category', enabled: '1' } },
      {
        name: '员工挂证 - 资质分页查询',
        resourceId: 683,
        method: 'POST',
        path: '/system-management/admin/system/employee/certification/page',
        body: { ...commonPage, employeeNo: '', name: '', department: '', certNo: '', workStatus: '', sort: null },
      },
    ],
  },
  {
    name: '上传中心',
    requests: [
      { name: '上传中心 - 视频上传列表', resourceId: 1418, method: 'POST', path: '/risk-management/admin/liveupload/list', body: { ...commonPage, status: '2' } },
    ],
  },
  {
    name: '下载中心',
    requests: [
      {
        name: '下载中心 - 下载任务列表',
        resourceId: downloadTaskListDefinitionId,
        method: 'POST',
        path: '/download-center/admin/v1/downloadTask/list',
        body: { ...commonPage, createBy: '', createByDeptCode: '' },
      },
    ],
  },
];

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
  const tagsJson = JSON.stringify(['风控中心', '菜单查询', 'Codex生成']);
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
