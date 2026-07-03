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
const codexDescription = '由 Codex 根据订单中心菜单首屏业务请求生成的可重复查询场景。';

const scenarios = [
  {
    name: '风控设置',
    requests: [
      {
        name: '风控设置 - 问卷列表',
        method: 'POST',
        path: '/order-admin/admin/questionnaire/manage/list',
        body: { pageIndex: 1, pageSize: 10, questionnaireId: '', questionnaireName: '', questionnaireStatus: 1 },
      },
    ],
  },
  {
    name: '退款协议',
    requests: [
      {
        name: '退款协议 - 配置列表',
        method: 'POST',
        path: '/order-admin/admin/refund/agreementConfig/list',
        body: {},
      },
    ],
  },
  {
    name: '商品分类',
    requests: [
      {
        name: '商品分类 - 分页查询',
        method: 'POST',
        path: '/order-admin/admin/commodity/item/page',
        body: { pageIndex: 1, pageSize: 10, itemName: '', itemStatus: 1, createBy: '' },
      },
    ],
  },
  {
    name: '商品规格',
    requests: [
      {
        name: '商品规格 - 名称下拉列表',
        method: 'GET',
        path: '/order-admin/admin/commodity/codeNameList',
        queryParams: [{ key: 'name', value: '' }],
      },
      {
        name: '商品规格 - 分页查询',
        method: 'POST',
        path: '/order-admin/admin/commodity/page',
        body: { pageIndex: 1, pageSize: 10, commodityId: '', indicatorName: '', indicatorStatus: 1 },
      },
    ],
  },
  {
    name: '商品权益',
    requests: [
      {
        name: '商品权益 - 分页查询',
        method: 'POST',
        path: '/order-admin/admin/commodity/equity/page',
        body: { pageIndex: 1, pageSize: 10, equityName: '', equityCode: '', equityStatus: 1 },
      },
    ],
  },
  {
    name: '优惠券管理',
    requests: [
      {
        name: '优惠券管理 - 分页查询',
        method: 'POST',
        path: '/order-admin/admin/marketing/coupon/page',
        body: {
          pageIndex: 1,
          pageSize: 10,
          name: '',
          type: '',
          couponStatus: 1,
          availableDeptCode: '',
          validEndTimeStart: '',
          validEndTimeEnd: '',
          validEndTime: '',
        },
      },
    ],
  },
  {
    name: '商品活动',
    requests: [
      {
        name: '商品活动 - 分页查询',
        method: 'POST',
        path: '/order-admin/admin/commodity/activity/page',
        body: {
          pageIndex: 1,
          pageSize: 10,
          activityName: '',
          activityEndDateStart: '',
          activityEndDateEnd: '',
          activityStatus: 1,
          dept1Code: '',
        },
      },
    ],
  },
  {
    name: '优惠券记录',
    requests: [
      {
        name: '优惠券记录 - 优惠券下拉列表',
        method: 'GET',
        path: '/order-admin/admin/marketing/coupon/codeNameList',
        queryParams: [{ key: 'name', value: '' }],
      },
      {
        name: '优惠券记录 - 分页查询',
        method: 'POST',
        path: '/order-admin/admin/coupon/order/page',
        body: {
          pageIndex: 1,
          pageSize: 10,
          couponOrderId: '',
          couponId: '',
          thirdPayId: '',
          wxName: '',
          orderStatus: '',
          payStatus: '',
          refundStatus: '',
          preSalesCode: '',
          preSalesDeptCode: '',
          activationTime: '',
          createTime: '',
          assignStatus: '',
          useStatus: '',
          couponOrderQuickSearch: 'ALL',
          activationTimeStart: '',
          activationTimeEnd: '',
          createTimeStart: '',
          createTimeEnd: '',
        },
      },
    ],
  },
  {
    name: '销售合同',
    requests: [
      {
        name: '销售合同 - 商品活动下拉数据',
        method: 'POST',
        path: '/order-admin/admin/commodity/activity/page',
        body: { pageIndex: 1, pageSize: 999 },
      },
      {
        name: '销售合同 - 订单分页查询',
        method: 'POST',
        path: '/order-admin/admin/order/page',
        body: {
          pageIndex: 1,
          pageSize: 10,
          orderQuickSearch: 'ALL',
          createTime: '',
          preSalesCode: '',
          preSalesCodeLabel: '',
          preSalesDeptCode: '',
          postSalesCode: '',
          postSalesCodeLabel: '',
          postSalesDeptCode: '',
          customerUnifiedId: '',
          customerUnifiedUserId: '',
          customerUserName: '',
          customerWxName: '',
          customerPhone: '',
          itemId: '',
          commodityId: '',
          activityId: '',
          teacherId: '',
          orderNo: '',
          payStatus: '',
          isRealName: '',
          isEvaluation: '',
          isContractSigned: '',
          isElectronicVisitCompleted: '',
          isFinishRisk: '',
          payMethod: '',
          contractType: '',
          orderCreateType: '',
          latestPayReviewSuccessTimeRange: '',
          createTimeStart: '',
          createTimeEnd: '',
          sourceChannel: '',
          channelMatchingMethod: '',
          orderId: '',
          payTimeRange: '',
          settlementTimeRange: '',
          containsPostSales: '',
          invoiceStatus: '',
          contractServerEndTimeRange: '',
          invoiceCondition: '',
          userFieldDetailDTOList: [],
          orderAuthType: 1,
        },
      },
    ],
  },
  {
    name: '退款审批',
    requests: [
      {
        name: '退款审批 - 审核状态统计',
        method: 'GET',
        path: '/order-admin/admin/order/refund/reviewStatusGroupCount',
      },
      {
        name: '退款审批 - 退款分页查询',
        method: 'POST',
        path: '/order-admin/admin/order/refund/page',
        body: { pageIndex: 1, pageSize: 10, unifiedUserId: '', sort: { field: '', order: '' } },
      },
    ],
  },
  {
    name: '付款审核',
    requests: [
      {
        name: '付款审核 - 页面帮助字典',
        method: 'POST',
        path: '/system-management/admin/system/dictData/list',
        body: { dictType: 'page_help_order_center_payment_list_index', enabled: '1' },
      },
      {
        name: '付款审核 - 付款列表报错探针',
        method: 'POST',
        path: '/order-admin/admin/order/pay/page',
        body: {
          pageIndex: 1,
          pageSize: 10,
          payTimeStart: '',
          payTimeEnd: '',
          orderId: '',
          unifiedId: '',
          unifiedUserId: '',
          wxName: '',
          userRelName: '',
          payChannel: '',
          preSalesCode: '',
          thirdPayId: '',
          payTimeRange: '',
          sort: null,
          reviewStatus: 'APPROVE',
        },
        codeOnly: true,
      },
    ],
  },
  {
    name: '发票记录',
    requests: [
      {
        name: '发票记录 - 分页查询',
        method: 'POST',
        path: '/finance-center/admin/v1/invoice/page',
        body: {
          pageIndex: 1,
          pageSize: 10,
          invoiceTimeStart: '',
          invoiceTimeEnd: '',
          invoiceStatus: '',
          orderId: '',
          invoiceTitle: '',
          invoiceKind: '',
          invoiceTimeRange: [],
        },
      },
    ],
  },
  {
    name: '财务对账',
    requests: [
      {
        name: '财务对账 - 页面帮助字典',
        method: 'POST',
        path: '/system-management/admin/system/dictData/list',
        body: { dictType: 'page_help_order_center_financial_reconciliation_index', enabled: '1' },
      },
      {
        name: '财务对账 - 支付渠道字典',
        method: 'POST',
        path: '/system-management/admin/system/dictData/list',
        body: { dictType: 'crm_order_pay_channel', enabled: '1' },
      },
      {
        name: '财务对账 - 对账列表报错探针',
        method: 'POST',
        path: '/marketing-center/admin/v1/order-reconciliation/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          time: '',
          payNo: '',
          payChannel: '',
          orderNo: '',
          tradingTimeStart: '',
          tradingTimeEnd: '',
          orderTypeList: ['1'],
        },
        codeOnly: true,
      },
    ],
  },
  {
    name: '资金明细',
    requests: [
      {
        name: '资金明细 - 分页查询',
        method: 'POST',
        path: '/finance-center/admin/v1/finance/page',
        body: {
          pageIndex: 1,
          pageSize: 10,
          payTimeStart: '',
          payTimeEnd: '',
          payBatchNo: '',
          paymentAccount: '',
          payeeName: '',
          payChannel: '',
          payRemark: '',
          merchantId: '',
          businessType: '',
          businessNo: '',
          matchStatus: '',
        },
      },
    ],
  },
];

function runMysql(sql) {
  const result = spawnSync('docker', mysqlArgs, { input: sql, encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `mysql exited with ${result.status}`);
  }
  return result.stdout.trim();
}

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function rawJson(value) {
  if (value === undefined) return null;
  return JSON.stringify(value, null, 2);
}

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyParam(overrides = {}) {
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

function assertionResponseCode() {
  return {
    type: null,
    subject: null,
    operator: null,
    expectedValue: '200',
    id: id('assertion-response_code'),
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

function assertionSuccessMsg() {
  return {
    type: 'RESPONSE_BODY',
    subject: null,
    operator: null,
    expectedValue: null,
    id: id('assertion-response_body'),
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

function requestConfig(request) {
  const isGet = request.method.toUpperCase() === 'GET';
  return {
    method: request.method.toUpperCase(),
    path: request.path,
    timeoutMs: 10000,
    queryParams: (request.queryParams || []).map((item) =>
      emptyParam({
        key: item.key,
        value: item.value ?? '',
        description: null,
        paramType: 'STRING',
        encode: true,
      }),
    ),
    headers: [
      emptyParam({ key: 'access-token', value: '{{access-token}}' }),
      emptyParam(),
    ],
    cookies: [],
    body: isGet
      ? { type: 'NONE', rawText: null, formItems: [], contentType: null, fileName: null, binaryBase64: null }
      : {
          type: 'RAW_JSON',
          rawText: rawJson(request.body ?? {}),
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

function loginStep() {
  return {
    id: id('draft-step'),
    stepName: '登录',
    stepType: 'API_SCENARIO',
    refType: 'REF',
    resourceType: null,
    resourceId: loginScenarioId,
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
  };
}

function apiStep(request, definitionId) {
  const hasDefinition = Number.isInteger(definitionId);
  return {
    id: id('draft-step'),
    stepName: request.name,
    stepType: hasDefinition ? 'API' : 'CUSTOM_REQUEST',
    refType: hasDefinition ? 'COPY' : 'DIRECT',
    resourceType: hasDefinition ? 'DEFINITION' : null,
    resourceId: hasDefinition ? definitionId : null,
    enabled: true,
    requestConfig: requestConfig(request),
    assertions: request.codeOnly ? [assertionResponseCode()] : [assertionResponseCode(), assertionSuccessMsg()],
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
  };
}

function loadDefinitions() {
  const paths = [...new Set(scenarios.flatMap((scenario) => scenario.requests.map((request) => request.path)))];
  const sql = `
SELECT path, MIN(id) AS id
FROM tb_api_definition
WHERE workspace_id = ${workspaceId}
  AND path IN (${paths.map(sqlString).join(',')})
GROUP BY path;
`;
  const rows = runMysql(sql);
  const map = new Map();
  for (const line of rows.split(/\r?\n/).filter(Boolean)) {
    const [path, idValue] = line.split('\t');
    map.set(path, Number(idValue));
  }
  return map;
}

function loadExistingScenarios() {
  const names = scenarios.map((scenario) => scenario.name);
  const sql = `
SELECT id, scenario_name, COALESCE(description, '')
FROM tb_api_scenario
WHERE workspace_id = ${workspaceId}
  AND module_id = ${moduleId}
  AND scenario_name IN (${names.map(sqlString).join(',')});
`;
  const rows = runMysql(sql);
  return rows
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [idValue, name, description] = line.split('\t');
      return { id: Number(idValue), name, description };
    });
}

const definitions = loadDefinitions();
const existing = loadExistingScenarios();
const existingByName = new Map(existing.map((row) => [row.name, row]));
const skipped = [];
const created = [];
const updated = [];
const statements = [];

for (const scenario of scenarios) {
  const existingRow = existingByName.get(scenario.name);
  if (existingRow && existingRow.description !== codexDescription) {
    skipped.push(`${scenario.name}：已存在非 Codex 生成场景，未覆盖`);
    continue;
  }

  const steps = [
    loginStep(),
    ...scenario.requests.map((request) => apiStep(request, definitions.get(request.path))),
  ];
  const stepsJson = JSON.stringify(steps);
  const tagsJson = JSON.stringify(['订单中心', '菜单查询', 'Codex生成']);

  if (existingRow) {
    statements.push(`
UPDATE tb_api_scenario
SET steps_json = ${sqlString(stepsJson)},
    tags_json = ${sqlString(tagsJson)},
    default_env_id = ${defaultEnvId},
    priority = 'P1',
    status = 'IN_PROGRESS',
    updated_at = CURRENT_TIMESTAMP
WHERE id = ${existingRow.id};
`);
    updated.push(scenario.name);
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
  runMysql(`START TRANSACTION;\n${statements.join('\n')}\nCOMMIT;`);
}

const summary = runMysql(`
SELECT id, scenario_name, module_id, default_env_id, JSON_LENGTH(steps_json) AS step_count
FROM tb_api_scenario
WHERE workspace_id = ${workspaceId}
  AND module_id = ${moduleId}
ORDER BY id;
`);

console.log(JSON.stringify({ created, updated, skipped, scenarios: summary }, null, 2));
