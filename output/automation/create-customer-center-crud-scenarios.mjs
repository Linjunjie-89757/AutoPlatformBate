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
const codexDescription = '由 Codex 根据获客中心低风险新增编辑删除接口生成的可重复闭环场景。';
const marketPageImageUrl = 'https://zhyt-scrm.oss-cn-hangzhou.aliyuncs.com/traffic-admin/1777272367730142.jpg';
const miniAppImageUrl = 'https://zhyt-scrm.oss-cn-hangzhou.aliyuncs.com/traffic-admin/1774934866042123.png';

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
  const noBody = ['GET', 'DELETE'].includes(method);
  return {
    method,
    path,
    timeoutMs: 10000,
    queryParams: [],
    headers: [param({ key: 'access-token', value: '{{access-token}}' }), param()],
    cookies: [],
    body: noBody
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
  AND http_method = ${sqlString(method)}
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
  ${workspaceId}, ${sqlString(name)}, ${sqlString(method)}, ${sqlString(path)}, ${sqlString('获客中心')}, ${sqlString('由 Codex 为获客中心 CRUD 场景补充的接口定义。')},
  ${sqlString(JSON.stringify(['获客中心', 'CRUD闭环', 'Codex生成']))}, ${sqlString(requestJson)}, '[]', '[]', '[]', '[]'
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

function apiStep({ name, method, path, body, assertions = [], extractors = [] }) {
  const resourceId = ensureDefinition({ name, method, path, body });
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

function dataEquals(value) {
  return { header: null, expression: '$.data', variableName: null, condition: 'EQUALS', expectedValue: String(value), enabled: null };
}

const scenarios = [
  {
    name: '主播管理-新增编辑删除闭环',
    steps: [
      loginStep(),
      scriptStep(`
const tag = Date.now().toString().slice(-8);
setVar('anchorName', 'AUTO_ANCHOR_' + tag);
setVar('anchorNameEdit', 'AUTO_ANCHOR_E_' + tag);
setVar('anchorCode', 'auto_anchor_' + tag);
setVar('anchorMobile', '139' + tag);
setVar('anchorCertCode', 'AUTO_CERT_' + tag);
log('anchor tag', tag);
`, ['anchorName', 'anchorNameEdit', 'anchorCode', 'anchorMobile', 'anchorCertCode']),
      apiStep({
        name: '新增主播',
        method: 'POST',
        path: '/traffic-admin/admin/v1/live-streamer/add',
        body: {
          liveStreamerName: '{{anchorName}}',
          liveStreamerCode: '{{anchorCode}}',
          avatar: '',
          mobile: '{{anchorMobile}}',
          categoryCode: '1',
          type: 0,
          operationTag: '',
          hireDate: 1782864000000,
          resignationDate: '',
          practicingQualificationCode: '{{anchorCertCode}}',
          teamId: '1930150017539706882',
          officeCode: 'ZHYT_XS',
          userCode: 'A2506001_80uf',
          sourceChannel: '',
          operationManager: 'A2506001_80uf',
          operator: 'A2506001_80uf',
          enableFlag: 1,
        },
        assertions: [{ header: null, expression: '$.data', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null }],
      }),
      apiStep({
        name: '查询新增主播并提取ID',
        method: 'POST',
        path: '/traffic-admin/admin/v1/live-streamer/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          liveStreamerName: '{{anchorName}}',
          liveStreamerCode: '',
          organizationId: '',
          teamId: '',
          officeCode: '',
          enableFlag: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null },
          { header: null, expression: '$.data.records[0].liveStreamerName', variableName: null, condition: 'EQUALS', expectedValue: '{{anchorName}}', enabled: null },
          { header: null, expression: '$.data.records[0].liveStreamerCode', variableName: null, condition: 'EQUALS', expectedValue: '{{anchorCode}}', enabled: null },
        ],
        extractors: [extractor('anchorId', '$.data.records[0].id')],
      }),
      apiStep({
        name: '编辑主播',
        method: 'POST',
        path: '/traffic-admin/admin/v1/live-streamer/update',
        body: {
          id: '{{anchorId}}',
          liveStreamerName: '{{anchorNameEdit}}',
          liveStreamerCode: '{{anchorCode}}',
          avatar: '',
          mobile: '{{anchorMobile}}',
          categoryCode: '1',
          type: 0,
          operationTag: '',
          hireDate: 1782864000000,
          resignationDate: '',
          practicingQualificationCode: '{{anchorCertCode}}',
          teamId: '1930150017539706882',
          officeCode: 'ZHYT_XS',
          userCode: 'A2506001_80uf',
          sourceChannel: '',
          operationManager: 'A2506001_80uf',
          operator: 'A2506001_80uf',
          enableFlag: 1,
        },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证主播已编辑',
        method: 'POST',
        path: '/traffic-admin/admin/v1/live-streamer/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          liveStreamerName: '{{anchorNameEdit}}',
          liveStreamerCode: '',
          organizationId: '',
          teamId: '',
          officeCode: '',
          enableFlag: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{anchorId}}', enabled: null },
          { header: null, expression: '$.data.records[0].liveStreamerName', variableName: null, condition: 'EQUALS', expectedValue: '{{anchorNameEdit}}', enabled: null },
          { header: null, expression: '$.data.records[0].mobile', variableName: null, condition: 'EQUALS', expectedValue: '{{anchorMobile}}', enabled: null },
        ],
      }),
      apiStep({
        name: '删除主播',
        method: 'POST',
        path: '/traffic-admin/admin/v1/live-streamer/delete',
        body: { id: '{{anchorId}}' },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证主播已删除',
        method: 'POST',
        path: '/traffic-admin/admin/v1/live-streamer/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          liveStreamerName: '{{anchorNameEdit}}',
          liveStreamerCode: '',
          organizationId: '',
          teamId: '',
          officeCode: '',
          enableFlag: '',
        },
        assertions: [{ header: null, expression: '$.data.total', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null }],
      }),
    ],
  },
  {
    name: '页面管理-新增编辑删除闭环',
    steps: [
      loginStep(),
      scriptStep(`
const tag = Date.now().toString().slice(-8);
setVar('marketPageName', 'AUTO_PAGE_' + tag);
setVar('marketPageNameEdit', 'AUTO_PAGE_E_' + tag);
log('market page tag', tag);
`, ['marketPageName', 'marketPageNameEdit']),
      apiStep({
        name: '新增页面',
        method: 'POST',
        path: '/traffic-admin/admin/v1/market-page/add',
        body: {
          urlName: '{{marketPageName}}',
          pageType: 2,
          targetPageType: 8,
          targetPageImage: [{ index: 0, url: marketPageImageUrl }],
          detailPageImage: [{ index: 0, url: marketPageImageUrl }],
          liveCodeImage: [{ index: 0, url: marketPageImageUrl }],
          targetBottomButtonSwitch: 0,
          targetBottomButtonImage: '',
          detailBottomButtonSwitch: 0,
          detailBottomButtonImage: '',
          linkedPageId: null,
          linkRemark: '',
          comparison: false,
          enableFlag: 1,
        },
        assertions: [{ header: null, expression: '$.data', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null }],
      }),
      apiStep({
        name: '查询新增页面并提取ID',
        method: 'POST',
        path: '/traffic-admin/admin/v1/market-page/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          urlName: '{{marketPageName}}',
          targetPageType: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null },
          { header: null, expression: '$.data.records[0].urlName', variableName: null, condition: 'EQUALS', expectedValue: '{{marketPageName}}', enabled: null },
          { header: null, expression: '$.data.records[0].commodityCount', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null },
        ],
        extractors: [extractor('marketPageId', '$.data.records[0].id')],
      }),
      apiStep({
        name: '编辑页面',
        method: 'POST',
        path: '/traffic-admin/admin/v1/market-page/update',
        body: {
          id: '{{marketPageId}}',
          urlName: '{{marketPageNameEdit}}',
          pageType: 2,
          targetPageType: 8,
          targetPageImage: [{ index: 0, url: marketPageImageUrl }],
          detailPageImage: [{ index: 0, url: marketPageImageUrl }],
          liveCodeImage: [{ index: 0, url: marketPageImageUrl }],
          targetBottomButtonSwitch: 0,
          targetBottomButtonImage: '',
          detailBottomButtonSwitch: 0,
          detailBottomButtonImage: '',
          linkedPageId: null,
          linkRemark: '',
          comparison: false,
          enableFlag: 1,
        },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证页面已编辑',
        method: 'POST',
        path: '/traffic-admin/admin/v1/market-page/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          urlName: '{{marketPageNameEdit}}',
          targetPageType: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{marketPageId}}', enabled: null },
          { header: null, expression: '$.data.records[0].urlName', variableName: null, condition: 'EQUALS', expectedValue: '{{marketPageNameEdit}}', enabled: null },
          { header: null, expression: '$.data.records[0].pageType', variableName: null, condition: 'EQUALS', expectedValue: '2', enabled: null },
          { header: null, expression: '$.data.records[0].targetPageType', variableName: null, condition: 'EQUALS', expectedValue: '8', enabled: null },
        ],
      }),
      apiStep({
        name: '删除页面',
        method: 'POST',
        path: '/traffic-admin/admin/v1/market-page/delete',
        body: { id: '{{marketPageId}}', ids: ['{{marketPageId}}'] },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证页面已删除',
        method: 'POST',
        path: '/traffic-admin/admin/v1/market-page/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          urlName: '{{marketPageNameEdit}}',
          targetPageType: '',
        },
        assertions: [{ header: null, expression: '$.data.total', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null }],
      }),
    ],
  },
  {
    name: '小程序管理-新增编辑停用删除闭环',
    steps: [
      loginStep(),
      scriptStep(`
const tag = Date.now().toString().slice(-8);
setVar('miniAppName', 'AUTO_MINI_' + tag);
setVar('miniAppNameEdit', 'AUTO_MINI_E_' + tag);
setVar('miniAppCode', 'AUTO_MINI_CODE_' + tag);
setVar('miniAppId', 'wxauto' + tag + 'abcd');
setVar('miniOriginalAppId', 'gh_auto_' + tag);
setVar('miniAppSecret', 'AUTO_SECRET_' + tag);
setVar('miniMerchantCode', 'AUTO_MCH_' + tag);
setVar('miniMerchantSecret', 'AUTO_MCH_SECRET_' + tag);
setVar('miniCertificate', 'AUTO_CERT_' + tag);
setVar('miniAppPhone', '138' + tag);
log('mini app tag', tag);
`, [
        'miniAppName',
        'miniAppNameEdit',
        'miniAppCode',
        'miniAppId',
        'miniOriginalAppId',
        'miniAppSecret',
        'miniMerchantCode',
        'miniMerchantSecret',
        'miniCertificate',
        'miniAppPhone',
      ]),
      apiStep({
        name: '新增小程序',
        method: 'POST',
        path: '/traffic-admin/admin/v1/mini-app/add',
        body: {
          appName: '{{miniAppName}}',
          appCode: '{{miniAppCode}}',
          icon: miniAppImageUrl,
          background: miniAppImageUrl,
          appDescription: '<p>自动化小程序 {{miniAppCode}}</p>',
          appId: '{{miniAppId}}',
          originalAppId: '{{miniOriginalAppId}}',
          appSecret: '{{miniAppSecret}}',
          merchantCode: '{{miniMerchantCode}}',
          merchantSecret: '{{miniMerchantSecret}}',
          certificate: '{{miniCertificate}}',
          consumerHotline: '{{miniAppPhone}}',
          aboutUs: '<p>自动化关于我们 {{miniAppCode}}</p>',
          consumerServiceType: 1,
          corpId: '',
          consumerServiceUrl: '',
          enableFlag: 1,
        },
        assertions: [{ header: null, expression: '$.data', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null }],
      }),
      apiStep({
        name: '查询新增小程序并提取ID',
        method: 'POST',
        path: '/traffic-admin/admin/v1/mini-app/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          appName: '{{miniAppName}}',
          appId: '',
          appCode: '',
          consumerServiceType: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null },
          { header: null, expression: '$.data.records[0].appName', variableName: null, condition: 'EQUALS', expectedValue: '{{miniAppName}}', enabled: null },
          { header: null, expression: '$.data.records[0].appCode', variableName: null, condition: 'EQUALS', expectedValue: '{{miniAppCode}}', enabled: null },
          { header: null, expression: '$.data.records[0].appId', variableName: null, condition: 'EQUALS', expectedValue: '{{miniAppId}}', enabled: null },
        ],
        extractors: [extractor('miniAppDbId', '$.data.records[0].id')],
      }),
      apiStep({
        name: '编辑小程序',
        method: 'POST',
        path: '/traffic-admin/admin/v1/mini-app/update',
        body: {
          id: '{{miniAppDbId}}',
          appName: '{{miniAppNameEdit}}',
          appCode: '{{miniAppCode}}',
          icon: miniAppImageUrl,
          background: miniAppImageUrl,
          appDescription: '<p>自动化小程序编辑 {{miniAppCode}}</p>',
          appId: '{{miniAppId}}',
          originalAppId: '{{miniOriginalAppId}}',
          appSecret: '{{miniAppSecret}}',
          merchantCode: '{{miniMerchantCode}}',
          merchantSecret: '{{miniMerchantSecret}}',
          certificate: '{{miniCertificate}}',
          consumerHotline: '{{miniAppPhone}}',
          aboutUs: '<p>自动化关于我们编辑 {{miniAppCode}}</p>',
          consumerServiceType: 1,
          corpId: '',
          consumerServiceUrl: '',
          enableFlag: 1,
        },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证小程序已编辑',
        method: 'POST',
        path: '/traffic-admin/admin/v1/mini-app/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          appName: '{{miniAppNameEdit}}',
          appId: '',
          appCode: '',
          consumerServiceType: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{miniAppDbId}}', enabled: null },
          { header: null, expression: '$.data.records[0].appName', variableName: null, condition: 'EQUALS', expectedValue: '{{miniAppNameEdit}}', enabled: null },
          { header: null, expression: '$.data.records[0].appCode', variableName: null, condition: 'EQUALS', expectedValue: '{{miniAppCode}}', enabled: null },
          { header: null, expression: '$.data.records[0].consumerServiceType', variableName: null, condition: 'EQUALS', expectedValue: '1', enabled: null },
        ],
      }),
      apiStep({
        name: '停用小程序',
        method: 'GET',
        path: '/traffic-admin/admin/v1/mini-app/updateEnable/{{miniAppDbId}}/0',
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证小程序已停用',
        method: 'POST',
        path: '/traffic-admin/admin/v1/mini-app/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          appName: '{{miniAppNameEdit}}',
          appId: '',
          appCode: '',
          consumerServiceType: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{miniAppDbId}}', enabled: null },
          { header: null, expression: '$.data.records[0].enableFlag', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null },
        ],
      }),
      apiStep({
        name: '删除小程序',
        method: 'POST',
        path: '/traffic-admin/admin/v1/mini-app/delete',
        body: { id: '{{miniAppDbId}}', ids: ['{{miniAppDbId}}'] },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证小程序已删除',
        method: 'POST',
        path: '/traffic-admin/admin/v1/mini-app/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          appName: '{{miniAppNameEdit}}',
          appId: '',
          appCode: '',
          consumerServiceType: '',
        },
        assertions: [{ header: null, expression: '$.data.total', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null }],
      }),
    ],
  },
  {
    name: '黑名单管理-新增编辑解除删除闭环',
    steps: [
      loginStep(),
      scriptStep(`
const tag = Date.now().toString().slice(-8);
setVar('blackMobile', '147' + tag);
setVar('blackUnionId', 'AUTO_BLACK_UNION_' + tag);
setVar('blackDeviceId', 'AUTO_BLACK_DEVICE_' + tag);
setVar('blackRemark', 'AUTO_BLACK_' + tag);
setVar('blackRemarkEdit', 'AUTO_BLACK_E_' + tag);
log('black list tag', tag);
`, ['blackMobile', 'blackUnionId', 'blackDeviceId', 'blackRemark', 'blackRemarkEdit']),
      apiStep({
        name: '新增黑名单',
        method: 'POST',
        path: '/traffic-admin/admin/v1/black-list-user/add',
        body: {
          type: ['1'],
          bizType: ['1'],
          mobile: '{{blackMobile}}',
          unionId: '{{blackUnionId}}',
          webDeviceId: '{{blackDeviceId}}',
          remark: '{{blackRemark}}',
          enableFlag: 1,
        },
        assertions: [{ header: null, expression: '$.data', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null }],
      }),
      apiStep({
        name: '查询新增黑名单并提取ID',
        method: 'POST',
        path: '/traffic-admin/admin/v1/black-list-user/search',
        body: {
          pageIndex: 1,
          pageSize: 10,
          type: [],
          bizType: [],
          mobile: '{{blackMobile}}',
          unionId: '',
          webDeviceId: '',
          nickName: '',
          userName: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null },
          { header: null, expression: '$.data.records[0].unionId', variableName: null, condition: 'EQUALS', expectedValue: '{{blackUnionId}}', enabled: null },
          { header: null, expression: '$.data.records[0].webDeviceId', variableName: null, condition: 'EQUALS', expectedValue: '{{blackDeviceId}}', enabled: null },
          { header: null, expression: '$.data.records[0].enableFlag', variableName: null, condition: 'EQUALS', expectedValue: '1', enabled: null },
        ],
        extractors: [extractor('blackListId', '$.data.records[0].id')],
      }),
      apiStep({
        name: '编辑黑名单',
        method: 'POST',
        path: '/traffic-admin/admin/v1/black-list-user/update',
        body: {
          id: '{{blackListId}}',
          type: ['2'],
          bizType: ['2'],
          mobile: '{{blackMobile}}',
          unionId: '{{blackUnionId}}',
          webDeviceId: '{{blackDeviceId}}',
          remark: '{{blackRemarkEdit}}',
          enableFlag: 1,
        },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证黑名单已编辑',
        method: 'POST',
        path: '/traffic-admin/admin/v1/black-list-user/search',
        body: {
          pageIndex: 1,
          pageSize: 10,
          type: [],
          bizType: [],
          mobile: '{{blackMobile}}',
          unionId: '',
          webDeviceId: '',
          nickName: '',
          userName: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{blackListId}}', enabled: null },
          { header: null, expression: '$.data.records[0].type', variableName: null, condition: 'EQUALS', expectedValue: '[2]', enabled: null },
          { header: null, expression: '$.data.records[0].bizType', variableName: null, condition: 'EQUALS', expectedValue: '[2]', enabled: null },
          { header: null, expression: '$.data.records[0].remark', variableName: null, condition: 'EQUALS', expectedValue: '{{blackRemarkEdit}}', enabled: null },
        ],
      }),
      apiStep({
        name: '解除黑名单',
        method: 'GET',
        path: '/traffic-admin/admin/v1/black-list-user/updateEnable/{{blackListId}}/0',
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证黑名单已解除',
        method: 'POST',
        path: '/traffic-admin/admin/v1/black-list-user/search',
        body: {
          pageIndex: 1,
          pageSize: 10,
          type: [],
          bizType: [],
          mobile: '{{blackMobile}}',
          unionId: '',
          webDeviceId: '',
          nickName: '',
          userName: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{blackListId}}', enabled: null },
          { header: null, expression: '$.data.records[0].enableFlag', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null },
        ],
      }),
      apiStep({
        name: '删除黑名单',
        method: 'POST',
        path: '/traffic-admin/admin/v1/black-list-user/delete',
        body: { id: '{{blackListId}}', ids: ['{{blackListId}}'] },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证黑名单已删除',
        method: 'POST',
        path: '/traffic-admin/admin/v1/black-list-user/search',
        body: {
          pageIndex: 1,
          pageSize: 10,
          type: [],
          bizType: [],
          mobile: '{{blackMobile}}',
          unionId: '',
          webDeviceId: '',
          nickName: '',
          userName: '',
        },
        assertions: [{ header: null, expression: '$.data.total', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null }],
      }),
    ],
  },
  {
    name: '白名单管理-新增编辑解除删除闭环',
    steps: [
      loginStep(),
      scriptStep(`
const tag = Date.now().toString().slice(-8);
setVar('whiteName', 'AUTO_WHITE_' + tag);
setVar('whiteNameEdit', 'AUTO_WHITE_E_' + tag);
setVar('whiteMobile', '148' + tag);
setVar('whiteUnionId', 'AUTO_WHITE_UNION_' + tag);
setVar('whiteDeviceId', 'AUTO_WHITE_DEVICE_' + tag);
setVar('whiteRemark', 'AUTO_WHITE_REMARK_' + tag);
setVar('whiteRemarkEdit', 'AUTO_WHITE_REMARK_E_' + tag);
log('white list tag', tag);
`, ['whiteName', 'whiteNameEdit', 'whiteMobile', 'whiteUnionId', 'whiteDeviceId', 'whiteRemark', 'whiteRemarkEdit']),
      apiStep({
        name: '新增白名单',
        method: 'POST',
        path: '/traffic-admin/admin/v1/developer/add',
        body: {
          type: 1,
          username: '{{whiteName}}',
          mobile: '{{whiteMobile}}',
          wxUnionId: '{{whiteUnionId}}',
          deviceId: '{{whiteDeviceId}}',
          remark: '{{whiteRemark}}',
          enableFlag: 1,
        },
        assertions: [{ header: null, expression: '$.data', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null }],
      }),
      apiStep({
        name: '查询新增白名单并提取ID',
        method: 'POST',
        path: '/traffic-admin/admin/v1/developer/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          type: '',
          username: '{{whiteName}}',
          mobile: '',
          wxUnionId: '',
          deviceId: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null },
          { header: null, expression: '$.data.records[0].username', variableName: null, condition: 'EQUALS', expectedValue: '{{whiteName}}', enabled: null },
          { header: null, expression: '$.data.records[0].wxUnionId', variableName: null, condition: 'EQUALS', expectedValue: '{{whiteUnionId}}', enabled: null },
          { header: null, expression: '$.data.records[0].deviceId', variableName: null, condition: 'EQUALS', expectedValue: '{{whiteDeviceId}}', enabled: null },
        ],
        extractors: [extractor('whiteListId', '$.data.records[0].id')],
      }),
      apiStep({
        name: '编辑白名单',
        method: 'POST',
        path: '/traffic-admin/admin/v1/developer/update',
        body: {
          id: '{{whiteListId}}',
          type: 2,
          username: '{{whiteNameEdit}}',
          mobile: '{{whiteMobile}}',
          wxUnionId: '{{whiteUnionId}}',
          deviceId: '{{whiteDeviceId}}',
          remark: '{{whiteRemarkEdit}}',
          enableFlag: 1,
        },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证白名单已编辑',
        method: 'POST',
        path: '/traffic-admin/admin/v1/developer/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          type: '',
          username: '{{whiteNameEdit}}',
          mobile: '',
          wxUnionId: '',
          deviceId: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{whiteListId}}', enabled: null },
          { header: null, expression: '$.data.records[0].username', variableName: null, condition: 'EQUALS', expectedValue: '{{whiteNameEdit}}', enabled: null },
          { header: null, expression: '$.data.records[0].type', variableName: null, condition: 'EQUALS', expectedValue: '2', enabled: null },
          { header: null, expression: '$.data.records[0].remark', variableName: null, condition: 'EQUALS', expectedValue: '{{whiteRemarkEdit}}', enabled: null },
        ],
      }),
      apiStep({
        name: '解除白名单',
        method: 'GET',
        path: '/traffic-admin/admin/v1/developer/updateEnable/{{whiteListId}}/0',
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证白名单已解除',
        method: 'POST',
        path: '/traffic-admin/admin/v1/developer/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          type: '',
          username: '{{whiteNameEdit}}',
          mobile: '',
          wxUnionId: '',
          deviceId: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{whiteListId}}', enabled: null },
          { header: null, expression: '$.data.records[0].enableFlag', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null },
        ],
      }),
      apiStep({
        name: '删除白名单',
        method: 'POST',
        path: '/traffic-admin/admin/v1/developer/delete',
        body: { id: '{{whiteListId}}', ids: ['{{whiteListId}}'] },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证白名单已删除',
        method: 'POST',
        path: '/traffic-admin/admin/v1/developer/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          type: '',
          username: '{{whiteNameEdit}}',
          mobile: '',
          wxUnionId: '',
          deviceId: '',
        },
        assertions: [{ header: null, expression: '$.data.total', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null }],
      }),
    ],
  },
  {
    name: '分配计划-新增编辑删除闭环',
    steps: [
      loginStep(),
      scriptStep(`
const tag = Date.now().toString().slice(-8);
setVar('assignPlanName', 'AUTO_PLAN_' + tag);
setVar('assignPlanNameEdit', 'AUTO_PLAN_E_' + tag);
setVar('assignPlanTopic', '自动化营销主题 ' + tag);
setVar('assignPlanTopicEdit', '自动化营销主题编辑 ' + tag);
setVar('assignPlanCustomerTag', 'AUTO_TAG_' + tag);
setVar('assignPlanCustomerTagEdit', 'AUTO_TAG_E_' + tag);
log('assign plan tag', tag);
`, ['assignPlanName', 'assignPlanNameEdit', 'assignPlanTopic', 'assignPlanTopicEdit', 'assignPlanCustomerTag', 'assignPlanCustomerTagEdit']),
      apiStep({
        name: '新增分配计划',
        method: 'POST',
        path: '/traffic-admin/admin/v1/order-assign-plan/add',
        body: {
          planName: '{{assignPlanName}}',
          topic: '{{assignPlanTopic}}',
          officeCode: 'ZHYT_XS09',
          officeCodes: ['ZHYT_XS09'],
          startTime: 1893456000000,
          endTime: 1894060800000,
          amount: 1,
          sourceId: 3,
          courseId: '136',
          customerTag: '{{assignPlanCustomerTag}}',
          notifyBot: '77630aa4-3f46-4029-9b7a-ed645172dc85',
          assignRuleVersion: 1,
        },
        assertions: [{ header: null, expression: '$.data', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null }],
      }),
      apiStep({
        name: '查询新增分配计划并提取ID',
        method: 'POST',
        path: '/traffic-admin/admin/v1/order-assign-plan/view-list',
        body: {
          planName: '{{assignPlanName}}',
          officeCode: '',
          startTime: '',
          endTime: '',
          time: '',
          pageIndex: 1,
          pageSize: 10,
          assignRuleVersion: '',
          rounds: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null },
          { header: null, expression: '$.data.records[0].planName', variableName: null, condition: 'EQUALS', expectedValue: '{{assignPlanName}}', enabled: null },
          { header: null, expression: '$.data.records[0].linked', variableName: null, condition: 'EQUALS', expectedValue: 'false', enabled: null },
        ],
        extractors: [extractor('assignPlanId', '$.data.records[0].id')],
      }),
      apiStep({
        name: '编辑分配计划',
        method: 'POST',
        path: '/traffic-admin/admin/v1/order-assign-plan/update',
        body: {
          id: '{{assignPlanId}}',
          planName: '{{assignPlanNameEdit}}',
          topic: '{{assignPlanTopicEdit}}',
          officeCode: 'ZHYT_XS09',
          officeCodes: ['ZHYT_XS09'],
          startTime: 1893456000000,
          endTime: 1894060800000,
          amount: 2,
          sourceId: 3,
          courseId: '136',
          customerTag: '{{assignPlanCustomerTagEdit}}',
          notifyBot: '77630aa4-3f46-4029-9b7a-ed645172dc85',
          assignRuleVersion: 1,
        },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证分配计划已编辑',
        method: 'POST',
        path: '/traffic-admin/admin/v1/order-assign-plan/view-list',
        body: {
          planName: '{{assignPlanNameEdit}}',
          officeCode: '',
          startTime: '',
          endTime: '',
          time: '',
          pageIndex: 1,
          pageSize: 10,
          assignRuleVersion: '',
          rounds: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{assignPlanId}}', enabled: null },
          { header: null, expression: '$.data.records[0].planName', variableName: null, condition: 'EQUALS', expectedValue: '{{assignPlanNameEdit}}', enabled: null },
          { header: null, expression: '$.data.records[0].amount', variableName: null, condition: 'EQUALS', expectedValue: '2', enabled: null },
        ],
      }),
      apiStep({
        name: '删除分配计划',
        method: 'POST',
        path: '/traffic-admin/admin/v1/order-assign-plan/delete',
        body: { id: '{{assignPlanId}}' },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证分配计划已删除',
        method: 'POST',
        path: '/traffic-admin/admin/v1/order-assign-plan/view-list',
        body: {
          planName: '{{assignPlanNameEdit}}',
          officeCode: '',
          startTime: '',
          endTime: '',
          time: '',
          pageIndex: 1,
          pageSize: 10,
          assignRuleVersion: '',
          rounds: '',
        },
        assertions: [{ header: null, expression: '$.data.total', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null }],
      }),
    ],
  },
  {
    name: '部门分类-新增编辑删除闭环',
    steps: [
      loginStep(),
      scriptStep(`
const tag = Date.now().toString().slice(-8);
setVar('deptName', 'AUTO_DEPT_' + tag);
setVar('deptNameEdit', 'AUTO_DEPT_E_' + tag);
setVar('deptDesc', '自动化CRUD生成 ' + tag);
setVar('deptDescEdit', '自动化CRUD编辑 ' + tag);
log('department tag', tag);
`, ['deptName', 'deptNameEdit', 'deptDesc', 'deptDescEdit']),
      apiStep({
        name: '新增部门分类',
        method: 'POST',
        path: '/traffic-admin/admin/v1/organization/add',
        body: { organizationName: '{{deptName}}', description: '{{deptDesc}}', enableFlag: 1 },
        assertions: [{ header: null, expression: '$.data', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null }],
        extractors: [extractor('departmentId', '$.data')],
      }),
      apiStep({
        name: '查询新增部门分类',
        method: 'POST',
        path: '/traffic-admin/admin/v1/organization/view-list',
        body: { pageIndex: 1, pageSize: 10, id: '{{departmentId}}', enableFlag: '' },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{departmentId}}', enabled: null },
          { header: null, expression: '$.data.records[0].organizationName', variableName: null, condition: 'EQUALS', expectedValue: '{{deptName}}', enabled: null },
        ],
      }),
      apiStep({
        name: '查询部门分类详情',
        method: 'GET',
        path: '/traffic-admin/admin/v1/organization/{{departmentId}}',
        assertions: [
          { header: null, expression: '$.data.id', variableName: null, condition: 'EQUALS', expectedValue: '{{departmentId}}', enabled: null },
          { header: null, expression: '$.data.organizationName', variableName: null, condition: 'EQUALS', expectedValue: '{{deptName}}', enabled: null },
        ],
      }),
      apiStep({
        name: '编辑部门分类',
        method: 'POST',
        path: '/traffic-admin/admin/v1/organization/update',
        body: { id: '{{departmentId}}', organizationName: '{{deptNameEdit}}', description: '{{deptDescEdit}}', enableFlag: 1 },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证部门分类已编辑',
        method: 'POST',
        path: '/traffic-admin/admin/v1/organization/view-list',
        body: { pageIndex: 1, pageSize: 10, id: '{{departmentId}}', enableFlag: '' },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{departmentId}}', enabled: null },
          { header: null, expression: '$.data.records[0].organizationName', variableName: null, condition: 'EQUALS', expectedValue: '{{deptNameEdit}}', enabled: null },
        ],
      }),
      apiStep({
        name: '删除部门分类',
        method: 'POST',
        path: '/traffic-admin/admin/v1/organization/delete',
        body: { id: '{{departmentId}}' },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证部门分类已删除',
        method: 'POST',
        path: '/traffic-admin/admin/v1/organization/view-list',
        body: { pageIndex: 1, pageSize: 10, id: '{{departmentId}}', enableFlag: '' },
        assertions: [{ header: null, expression: '$.data.total', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null }],
      }),
    ],
  },
  {
    name: '广告主设置-新增编辑停用删除闭环',
    steps: [
      loginStep(),
      scriptStep(`
const tag = Date.now().toString().slice(-8);
setVar('advertiserId', '99' + tag);
setVar('advertiserName', 'AUTO_ADV_' + tag);
setVar('advertiserNameEdit', 'AUTO_ADV_E_' + tag);
log('advertiser tag', tag);
`, ['advertiserId', 'advertiserName', 'advertiserNameEdit']),
      apiStep({
        name: '新增广告主',
        method: 'POST',
        path: '/traffic-admin/admin/v1/ad-advertiser/add',
        body: {
          platform: 'ocean_engine',
          advertiserId: '{{advertiserId}}',
          advertiserName: '{{advertiserName}}',
          addTime: 1783000000000,
          officeCode: 'ZHYT_XS09',
          enableFlag: 1,
        },
        assertions: [{ header: null, expression: '$.data', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null }],
      }),
      apiStep({
        name: '查询新增广告主并提取ID',
        method: 'POST',
        path: '/traffic-admin/admin/v1/ad-advertiser/search',
        body: { pageIndex: 1, pageSize: 10, advertiserId: '{{advertiserId}}', advertiserName: '', platform: '', enableFlag: '' },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null },
          { header: null, expression: '$.data.records[0].advertiserName', variableName: null, condition: 'EQUALS', expectedValue: '{{advertiserName}}', enabled: null },
        ],
        extractors: [extractor('advertiserDbId', '$.data.records[0].id')],
      }),
      apiStep({
        name: '编辑广告主',
        method: 'POST',
        path: '/traffic-admin/admin/v1/ad-advertiser/update',
        body: {
          id: '{{advertiserDbId}}',
          platform: 'ocean_engine',
          advertiserId: '{{advertiserId}}',
          advertiserName: '{{advertiserNameEdit}}',
          addTime: 1783000000000,
          officeCode: 'ZHYT_XS09',
          enableFlag: 1,
        },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证广告主已编辑',
        method: 'POST',
        path: '/traffic-admin/admin/v1/ad-advertiser/search',
        body: { pageIndex: 1, pageSize: 10, advertiserId: '{{advertiserId}}', advertiserName: '{{advertiserNameEdit}}', platform: '', enableFlag: '' },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{advertiserDbId}}', enabled: null },
          { header: null, expression: '$.data.records[0].advertiserName', variableName: null, condition: 'EQUALS', expectedValue: '{{advertiserNameEdit}}', enabled: null },
        ],
      }),
      apiStep({
        name: '停用广告主',
        method: 'POST',
        path: '/traffic-admin/admin/v1/ad-advertiser/switchEnableFlag/{{advertiserDbId}}/0',
        body: {},
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证广告主已停用',
        method: 'POST',
        path: '/traffic-admin/admin/v1/ad-advertiser/search',
        body: { pageIndex: 1, pageSize: 10, advertiserId: '{{advertiserId}}', advertiserName: '{{advertiserNameEdit}}', platform: '', enableFlag: '' },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{advertiserDbId}}', enabled: null },
          { header: null, expression: '$.data.records[0].enableFlag', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null },
        ],
      }),
      apiStep({
        name: '删除广告主',
        method: 'DELETE',
        path: '/traffic-admin/admin/v1/ad-advertiser/delete/{{advertiserDbId}}',
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证广告主已删除',
        method: 'POST',
        path: '/traffic-admin/admin/v1/ad-advertiser/search',
        body: { pageIndex: 1, pageSize: 10, advertiserId: '{{advertiserId}}', advertiserName: '', platform: '', enableFlag: '' },
        assertions: [{ header: null, expression: '$.data.total', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null }],
      }),
    ],
  },
  {
    name: '产品管理-新增编辑停用删除闭环',
    steps: [
      loginStep(),
      scriptStep(`
const tag = Date.now().toString().slice(-8);
setVar('commodityName', 'AUTO_COMMODITY_' + tag);
setVar('commodityNameEdit', 'AUTO_COMMODITY_E_' + tag);
setVar('wxKfMenuContent', 'AUTO_WX_CONTENT_' + tag);
setVar('wxKfMenuViewMsg', 'AUTO_VIEW_' + tag);
log('commodity tag', tag);
`, ['commodityName', 'commodityNameEdit', 'wxKfMenuContent', 'wxKfMenuViewMsg']),
      apiStep({
        name: '新增产品',
        method: 'POST',
        path: '/traffic-admin/admin/v1/commodity/add',
        body: {
          commodityName: '{{commodityName}}',
          marketPageId: '2016395089171628034',
          miniAppId: '1793882302605619202',
          commodityImage: 'https://zhyt-scrm.oss-cn-hangzhou.aliyuncs.com/traffic-admin/178158797160863.png',
          sourceChannel: '1954',
          assignPlanId: '2064897561737900033',
          platform: 'douyin',
          streamCode: 'RTkwtYtG',
          price: 0.01,
          repeatBuyType: 0,
          repeatBuyTimeLimit: 0,
          refundType: 0,
          autoRefundTimeLimit: 24,
          showRefund: 1,
          showRefundTimeLimit: 0,
          smsNotify: 0,
          callbackFlag: 1,
          assignRuleVersion: 1,
          assignType: 1,
          enableFlag: 1,
          autoCloseFlag: 0,
          autoCloseTimeLimit: 24,
          addWxCheckFlag: 0,
          addWxCheckTimeLimit: 3,
          addWxCheckCountLimit: 3,
          wxKfMenuContent: '{{wxKfMenuContent}}',
          wxKfMenuViewMsg: '{{wxKfMenuViewMsg}}',
        },
        assertions: [{ header: null, expression: '$.data', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null }],
      }),
      apiStep({
        name: '查询新增产品并提取ID',
        method: 'POST',
        path: '/traffic-admin/admin/v1/commodity/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          commodityName: '{{commodityName}}',
          commodityCode: '',
          marketPageId: '',
          miniAppId: '',
          sourceChannel: '',
          assignPlanId: '',
          streamCode: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'NOT_EMPTY', expectedValue: '', enabled: null },
          { header: null, expression: '$.data.records[0].commodityName', variableName: null, condition: 'EQUALS', expectedValue: '{{commodityName}}', enabled: null },
          { header: null, expression: '$.data.records[0].orderCount', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null },
        ],
        extractors: [extractor('commodityId', '$.data.records[0].id')],
      }),
      apiStep({
        name: '编辑产品',
        method: 'POST',
        path: '/traffic-admin/admin/v1/commodity/update',
        body: {
          id: '{{commodityId}}',
          commodityName: '{{commodityNameEdit}}',
          marketPageId: '2016395089171628034',
          miniAppId: '1793882302605619202',
          commodityImage: 'https://zhyt-scrm.oss-cn-hangzhou.aliyuncs.com/traffic-admin/178158797160863.png',
          sourceChannel: '1954',
          assignPlanId: '2064897561737900033',
          platform: 'douyin',
          streamCode: 'RTkwtYtG',
          price: 0.01,
          repeatBuyType: 0,
          repeatBuyTimeLimit: 0,
          refundType: 0,
          autoRefundTimeLimit: 24,
          showRefund: 1,
          showRefundTimeLimit: 0,
          smsNotify: 0,
          callbackFlag: 1,
          assignRuleVersion: 1,
          assignType: 1,
          enableFlag: 1,
          autoCloseFlag: 0,
          autoCloseTimeLimit: 24,
          addWxCheckFlag: 0,
          addWxCheckTimeLimit: 3,
          addWxCheckCountLimit: 3,
          wxKfMenuContent: '{{wxKfMenuContent}}',
          wxKfMenuViewMsg: '{{wxKfMenuViewMsg}}',
        },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证产品已编辑',
        method: 'POST',
        path: '/traffic-admin/admin/v1/commodity/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          commodityName: '{{commodityNameEdit}}',
          commodityCode: '',
          marketPageId: '',
          miniAppId: '',
          sourceChannel: '',
          assignPlanId: '',
          streamCode: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{commodityId}}', enabled: null },
          { header: null, expression: '$.data.records[0].commodityName', variableName: null, condition: 'EQUALS', expectedValue: '{{commodityNameEdit}}', enabled: null },
          { header: null, expression: '$.data.records[0].enableFlag', variableName: null, condition: 'EQUALS', expectedValue: '1', enabled: null },
        ],
      }),
      apiStep({
        name: '停用产品',
        method: 'GET',
        path: '/traffic-admin/admin/v1/commodity/updateEnable/{{commodityId}}/0',
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证产品已停用',
        method: 'POST',
        path: '/traffic-admin/admin/v1/commodity/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          commodityName: '{{commodityNameEdit}}',
          commodityCode: '',
          marketPageId: '',
          miniAppId: '',
          sourceChannel: '',
          assignPlanId: '',
          streamCode: '',
        },
        assertions: [
          { header: null, expression: '$.data.records[0].id', variableName: null, condition: 'EQUALS', expectedValue: '{{commodityId}}', enabled: null },
          { header: null, expression: '$.data.records[0].enableFlag', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null },
        ],
      }),
      apiStep({
        name: '删除产品',
        method: 'POST',
        path: '/traffic-admin/admin/v1/commodity/delete',
        body: { id: '{{commodityId}}', ids: ['{{commodityId}}'] },
        assertions: [dataEquals(1)],
      }),
      apiStep({
        name: '查询验证产品已删除',
        method: 'POST',
        path: '/traffic-admin/admin/v1/commodity/view-list',
        body: {
          pageIndex: 1,
          pageSize: 10,
          commodityName: '{{commodityNameEdit}}',
          commodityCode: '',
          marketPageId: '',
          miniAppId: '',
          sourceChannel: '',
          assignPlanId: '',
          streamCode: '',
        },
        assertions: [{ header: null, expression: '$.data.total', variableName: null, condition: 'EQUALS', expectedValue: '0', enabled: null }],
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

  const tagsJson = JSON.stringify(['获客中心', 'CRUD闭环', 'Codex生成']);
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
