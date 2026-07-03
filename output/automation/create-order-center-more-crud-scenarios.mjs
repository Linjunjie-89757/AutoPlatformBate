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
const moduleId = 3;
const defaultEnvId = 15;
const loginScenarioId = 3;
const codexDescription = '由 Codex 根据订单中心低风险新增编辑接口生成的可重复闭环场景。';

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

function assertionBody(items = []) {
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
        ...items,
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

function extractor(name, expression) {
  return {
    id: uid('post-extract'),
    processorType: 'EXTRACT',
    name: `提取 ${name}`,
    enabled: true,
    description: null,
    scriptLanguage: null,
    script: expression,
    delayMs: 1000,
    dataSourceId: null,
    dataSourceName: null,
    queryTimeout: 30000,
    variableNames: null,
    extractParams: [],
    resultVariable: null,
    extractors: [{
      name,
      sourceType: 'RESPONSE_BODY',
      expression,
      enabled: true,
      variableName: name,
      description: null,
      variableType: 'TEMPORARY',
      extractType: 'JSON_PATH',
      extractScope: 'BODY',
      expressionMatchingRule: 'EXPRESSION',
      resultMatchingRule: 'SPECIFIC',
      resultMatchingRuleNum: 1,
      responseFormat: 'JSON',
    }],
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

function baseStep(overrides) {
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
  return baseStep({
    stepName: '登录',
    stepType: 'API_SCENARIO',
    refType: 'REF',
    resourceType: null,
    resourceId: loginScenarioId,
  });
}

function scriptStep(script, variables) {
  return baseStep({
    stepName: '生成本次测试数据',
    stepType: 'SCRIPT',
    refType: 'DIRECT',
    resourceType: null,
    resourceId: null,
    script,
    assertions: [{
      type: null,
      subject: null,
      operator: null,
      expectedValue: null,
      id: uid('assertion-variable'),
      assertionType: 'VARIABLE',
      name: '变量校验',
      enabled: true,
      description: null,
      condition: null,
      assertions: null,
      assertionBodyType: null,
      jsonPathAssertion: null,
      xpathAssertion: null,
      regexAssertion: null,
      variableAssertionItems: variables.map((variableName) => ({
        header: null,
        expression: null,
        variableName,
        condition: 'NOT_EMPTY',
        expectedValue: '',
        enabled: null,
      })),
      scriptLanguage: null,
      script: null,
    }],
  });
}

function apiStep({ name, resourceId, method, path, body, assertions = [], extractors = [] }) {
  return baseStep({
    stepName: name,
    stepType: 'API',
    refType: 'COPY',
    resourceType: 'DEFINITION',
    resourceId,
    requestConfig: requestConfig(method, path, body),
    assertions: [assertionCode(), assertionBody(assertions)],
    postProcessors: extractors,
  });
}

function successDataAssertion() {
  return { header: null, expression: '$.data', variableName: null, condition: 'EQUALS', expectedValue: 'success', enabled: null };
}

const scenarios = [
  {
    name: '商品规格-新增编辑闭环',
    steps: [
      loginStep(),
      scriptStep(`
const tag = Date.now().toString().slice(-8);
setVar('specCommodityName', 'AUTO_SPEC_' + tag);
setVar('specIndicatorName', 'SP_' + tag);
setVar('specIndicatorNameEdit', 'SE_' + tag);
log('spec tag', tag);
`, ['specCommodityName', 'specIndicatorName', 'specIndicatorNameEdit']),
      apiStep({
        name: '新增商品规格',
        resourceId: 641,
        method: 'POST',
        path: '/order-admin/admin/commodity/saveOrUpdate',
        body: {
          commodityName: '{{specCommodityName}}',
          itemId: '56',
          commodityIndicatorList: [{
            indicatorName: '{{specIndicatorName}}',
            unitValue: 1,
            price: 0.01,
            riskLevel: 1,
            indicatorStatus: 1,
          }],
        },
        assertions: [successDataAssertion()],
      }),
      apiStep({
        name: '查询新增商品规格并提取ID',
        resourceId: 639,
        method: 'POST',
        path: '/order-admin/admin/commodity/page',
        body: {
          pageIndex: 1,
          pageSize: 10,
          commodityId: '',
          commodityName: '{{specCommodityName}}',
          indicatorName: '',
          indicatorStatus: 1,
        },
        assertions: [
          { header: null, expression: '$.data.records[0].commodityId', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null },
          { header: null, expression: '$.data.records[0].indicatorId', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null },
          { header: null, expression: '$.data.records[0].indicatorName', variableName: null, condition: 'EQUALS', expectedValue: '{{specIndicatorName}}', enabled: null },
        ],
        extractors: [extractor('commodityId', '$.data.records[0].commodityId'), extractor('indicatorId', '$.data.records[0].indicatorId')],
      }),
      apiStep({
        name: '编辑并停用商品规格',
        resourceId: 641,
        method: 'POST',
        path: '/order-admin/admin/commodity/saveOrUpdate',
        body: {
          commodityId: '{{commodityId}}',
          commodityName: '{{specCommodityName}}',
          itemId: '56',
          commodityIndicatorList: [{
            indicatorId: '{{indicatorId}}',
            indicatorName: '{{specIndicatorNameEdit}}',
            unitValue: 2,
            price: 0.02,
            riskLevel: 1,
            indicatorStatus: 2,
          }],
        },
        assertions: [successDataAssertion()],
      }),
      apiStep({
        name: '查询验证商品规格已编辑',
        resourceId: 639,
        method: 'POST',
        path: '/order-admin/admin/commodity/page',
        body: {
          pageIndex: 1,
          pageSize: 10,
          commodityId: '{{commodityId}}',
          commodityName: '{{specCommodityName}}',
          indicatorName: '{{specIndicatorNameEdit}}',
          indicatorStatus: 2,
        },
        assertions: [
          { header: null, expression: '$.data.records[0].commodityId', variableName: null, condition: 'EQUALS', expectedValue: '{{commodityId}}', enabled: null },
          { header: null, expression: '$.data.records[0].indicatorName', variableName: null, condition: 'EQUALS', expectedValue: '{{specIndicatorNameEdit}}', enabled: null },
        ],
      }),
    ],
  },
  {
    name: '商品活动-新增下架编辑闭环',
    steps: [
      loginStep(),
      scriptStep(`
const tag = Date.now().toString().slice(-8);
setVar('activityName', 'AUTO_ACT_' + tag);
setVar('activityNameEdit', 'AUTO_ACT_E_' + tag);
setVar('runTag', tag);
log('activity tag', tag);
`, ['activityName', 'activityNameEdit', 'runTag']),
      apiStep({
        name: '新增商品活动',
        resourceId: 649,
        method: 'POST',
        path: '/order-admin/admin/commodity/activity/saveOrUpdate',
        body: {
          activityName: '{{activityName}}',
          dept1Code: 'ZHYT_XS09',
          activityStartDate: '2026-06-28T16:00:00.000Z',
          activityEndDate: '2026-06-29T16:00:00.000Z',
          thirdActivityId: '',
          remark: '自动化CRUD生成 {{runTag}}',
          teacherId: 'A2506001_80uf',
          activityIndicator: {
            itemId: 56,
            commodityId: 87,
            indicatorId: 202,
            giftServiceMonth: 0,
            originalPrice: 0,
            activityPrice: 0.01,
          },
          activityEquityList: [{ equityCode: '406', equityType: 'PAID', openLimitMonth: 1 }],
          pcPosterUrl: [],
          appPosterUrl: [],
          pcBottomButtonUrl: [''],
          appBottomButtonUrl: [''],
          posterStatus: 2,
        },
        assertions: [successDataAssertion()],
      }),
      apiStep({
        name: '查询新增商品活动并提取ID',
        resourceId: 646,
        method: 'POST',
        path: '/order-admin/admin/commodity/activity/page',
        body: {
          pageIndex: 1,
          pageSize: 10,
          activityName: '{{activityName}}',
          activityEndDateStart: '',
          activityEndDateEnd: '',
          activityStatus: 1,
          dept1Code: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].activityId', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null },
          { header: null, expression: '$.data.records[0].activityName', variableName: null, condition: 'EQUALS', expectedValue: '{{activityName}}', enabled: null },
        ],
        extractors: [extractor('activityId', '$.data.records[0].activityId')],
      }),
      apiStep({
        name: '下架商品活动',
        resourceId: 650,
        method: 'GET',
        path: '/order-admin/admin/commodity/activity/updateEnable/{{activityId}}/2',
        assertions: [successDataAssertion()],
      }),
      apiStep({
        name: '编辑已下架商品活动',
        resourceId: 649,
        method: 'POST',
        path: '/order-admin/admin/commodity/activity/saveOrUpdate',
        body: {
          activityId: '{{activityId}}',
          activityName: '{{activityNameEdit}}',
          dept1Code: 'ZHYT_XS09',
          activityStartDate: '2026-06-28T16:00:00.000Z',
          activityEndDate: '2026-06-29T16:00:00.000Z',
          thirdActivityId: '',
          remark: '自动化CRUD编辑 {{runTag}}',
          teacherId: 'A2506001_80uf',
          activityIndicator: {
            itemId: 56,
            commodityId: 87,
            indicatorId: 202,
            giftServiceMonth: 0,
            originalPrice: 0,
            activityPrice: 0.01,
          },
          activityEquityList: [{ equityCode: '406', equityType: 'PAID', openLimitMonth: 1 }],
          pcPosterUrl: [],
          appPosterUrl: [],
          pcBottomButtonUrl: [''],
          appBottomButtonUrl: [''],
          posterStatus: 2,
        },
        assertions: [successDataAssertion()],
      }),
      apiStep({
        name: '查询验证商品活动已编辑',
        resourceId: 646,
        method: 'POST',
        path: '/order-admin/admin/commodity/activity/page',
        body: {
          pageIndex: 1,
          pageSize: 10,
          activityName: '{{activityNameEdit}}',
          activityEndDateStart: '',
          activityEndDateEnd: '',
          activityStatus: 2,
          dept1Code: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].activityId', variableName: null, condition: 'EQUALS', expectedValue: '{{activityId}}', enabled: null },
          { header: null, expression: '$.data.records[0].activityName', variableName: null, condition: 'EQUALS', expectedValue: '{{activityNameEdit}}', enabled: null },
        ],
      }),
    ],
  },
  {
    name: '风控设置-问卷新增编辑闭环',
    steps: [
      loginStep(),
      scriptStep(`
const tag = Date.now().toString().slice(-8);
setVar('questionnaireName', 'AUTO_QUES_' + tag);
setVar('questionnaireNameEdit', 'AUTO_QUES_E_' + tag);
setVar('runTag', tag);
log('questionnaire tag', tag);
`, ['questionnaireName', 'questionnaireNameEdit', 'runTag']),
      apiStep({
        name: '新增风控问卷',
        resourceId: 499,
        method: 'POST',
        path: '/order-admin/admin/questionnaire/manage/saveOrUpdate',
        body: {
          questionnaireId: '',
          questionnaireName: '{{questionnaireName}}',
          questionnaireExplain: '自动化CRUD生成 {{runTag}}',
          questionnaireType: 1,
        },
        assertions: [{ header: null, expression: '$.data', variableName: null, condition: 'EQUALS', expectedValue: 'true', enabled: null }],
      }),
      apiStep({
        name: '查询新增风控问卷并提取ID',
        resourceId: 501,
        method: 'POST',
        path: '/order-admin/admin/questionnaire/manage/list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          questionnaireId: '',
          questionnaireName: '{{questionnaireName}}',
          questionnaireStatus: 2,
          questionnaireType: 1,
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null },
          { header: null, expression: '$.data.records[0].questionnaireName', variableName: null, condition: 'EQUALS', expectedValue: '{{questionnaireName}}', enabled: null },
        ],
        extractors: [extractor('questionnaireId', '$.data.records[0].id')],
      }),
      apiStep({
        name: '查询风控问卷详情',
        resourceId: 597,
        method: 'GET',
        path: '/order-admin/admin/questionnaire/manage/queryDetail/{{questionnaireId}}',
        assertions: [
          { header: null, expression: '$.data.questionnaireName', variableName: null, condition: 'EQUALS', expectedValue: '{{questionnaireName}}', enabled: null },
        ],
      }),
      apiStep({
        name: '编辑风控问卷',
        resourceId: 499,
        method: 'POST',
        path: '/order-admin/admin/questionnaire/manage/saveOrUpdate',
        body: {
          questionnaireId: '{{questionnaireId}}',
          questionnaireName: '{{questionnaireNameEdit}}',
          questionnaireExplain: '自动化CRUD编辑 {{runTag}}',
          questionnaireType: 1,
        },
        assertions: [{ header: null, expression: '$.data', variableName: null, condition: 'EQUALS', expectedValue: 'true', enabled: null }],
      }),
      apiStep({
        name: '查询验证风控问卷已编辑',
        resourceId: 501,
        method: 'POST',
        path: '/order-admin/admin/questionnaire/manage/list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          questionnaireId: '',
          questionnaireName: '{{questionnaireNameEdit}}',
          questionnaireStatus: 2,
          questionnaireType: 1,
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{questionnaireId}}', enabled: null },
          { header: null, expression: '$.data.records[0].questionnaireName', variableName: null, condition: 'EQUALS', expectedValue: '{{questionnaireNameEdit}}', enabled: null },
        ],
      }),
    ],
  },
];

const names = scenarios.map((scenario) => scenario.name);
const existingOutput = mysql(`
SELECT id, scenario_name, COALESCE(description, '')
FROM tb_api_scenario
WHERE workspace_id = ${workspaceId}
  AND module_id = ${moduleId}
  AND scenario_name IN (${names.map(sqlString).join(',')});
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

  const tagsJson = JSON.stringify(['订单中心', 'CRUD闭环', 'Codex生成']);
  const stepsJson = JSON.stringify(scenario.steps);
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
  AND scenario_name IN (${names.map(sqlString).join(',')})
ORDER BY id;
`);

console.log(JSON.stringify({ created, updated, skipped, result }, null, 2));
