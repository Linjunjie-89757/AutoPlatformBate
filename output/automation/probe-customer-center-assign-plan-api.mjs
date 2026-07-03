const baseUrl = 'https://japi-test.integrity.com.cn';
const account = '19966468884';
const password = 'Shitao123@';
const tag = Date.now().toString().slice(-8);
const planName = `AUTO_PLAN_${tag}`;
const planNameEdit = `AUTO_PLAN_E_${tag}`;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body, text };
}

async function mustRequest(path, options = {}) {
  const result = await request(path, options);
  if (!result.response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${result.response.status}: ${result.text}`);
  }
  return result.body;
}

async function login() {
  const loginBody = await mustRequest('/user-auth/auth/v1/back-unified-login/by-pwd', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account, pwdKey: password }),
  });
  const verifyBody = await mustRequest('/system-admin/auth/v1/secret-token/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secretToken: loginBody.data.secretToken }),
  });
  return verifyBody.data.accessToken;
}

async function api(accessToken, method, path, body) {
  return request(path, {
    method,
    headers: { 'content-type': 'application/json', 'access-token': accessToken },
    body: body == null ? undefined : JSON.stringify(body),
  });
}

const accessToken = await login();
const startTime = Date.UTC(2026, 6, 3);
const endTime = Date.UTC(2026, 6, 10);
const baseBody = {
  planName,
  topic: `自动化营销主题 ${tag}`,
  officeCode: 'ZHYT_XS09',
  startTime,
  endTime,
  amount: 1,
  sourceId: 3,
  courseId: '136',
  customerTag: `AUTO_TAG_${tag}`,
  notifyBot: '77630aa4-3f46-4029-9b7a-ed645172dc85',
  assignRuleVersion: 1,
};

const candidates = [
  { method: 'POST', path: '/traffic-admin/admin/v1/order-assign-plan/add', body: baseBody },
  { method: 'POST', path: '/traffic-admin/admin/v1/order-assign-plan/save', body: baseBody },
  { method: 'POST', path: '/traffic-admin/admin/v1/order-assign-plan/save-or-update', body: baseBody },
  { method: 'POST', path: '/traffic-admin/admin/v1/order-assign-plan/saveOrUpdate', body: baseBody },
];

const attempts = [];
let created = null;
for (const candidate of candidates) {
  const result = await api(accessToken, candidate.method, candidate.path, candidate.body);
  attempts.push({ ...candidate, status: result.response.status, body: result.body });
  if (result.response.ok && result.body?.msg === 'success') {
    created = { candidate, body: result.body };
    break;
  }
}

const search = await api(accessToken, 'POST', '/traffic-admin/admin/v1/order-assign-plan/view-list', {
  planName,
  officeCode: '',
  startTime: '',
  endTime: '',
  time: '',
  pageIndex: 1,
  pageSize: 10,
  assignRuleVersion: '',
  rounds: '',
});
const id = search.body?.data?.records?.[0]?.id;
const updateAttempts = [];
const deleteAttempts = [];

if (id) {
  const updateBody = { ...baseBody, id, planName: planNameEdit, topic: `自动化营销主题编辑 ${tag}`, amount: 2 };
  for (const candidate of [
    { method: 'POST', path: '/traffic-admin/admin/v1/order-assign-plan/update', body: updateBody },
    { method: 'POST', path: '/traffic-admin/admin/v1/order-assign-plan/saveOrUpdate', body: updateBody },
    { method: 'POST', path: '/traffic-admin/admin/v1/order-assign-plan/edit', body: updateBody },
  ]) {
    const result = await api(accessToken, candidate.method, candidate.path, candidate.body);
    updateAttempts.push({ ...candidate, status: result.response.status, body: result.body });
    if (result.response.ok && result.body?.msg === 'success') break;
  }

  for (const candidate of [
    { method: 'POST', path: '/traffic-admin/admin/v1/order-assign-plan/delete', body: { id } },
    { method: 'DELETE', path: `/traffic-admin/admin/v1/order-assign-plan/delete/${id}`, body: null },
    { method: 'POST', path: `/traffic-admin/admin/v1/order-assign-plan/delete/${id}`, body: {} },
  ]) {
    const result = await api(accessToken, candidate.method, candidate.path, candidate.body);
    deleteAttempts.push({ ...candidate, status: result.response.status, body: result.body });
    if (result.response.ok && result.body?.msg === 'success') break;
  }
}

const searchAfter = await api(accessToken, 'POST', '/traffic-admin/admin/v1/order-assign-plan/view-list', {
  planName: planNameEdit,
  officeCode: '',
  startTime: '',
  endTime: '',
  time: '',
  pageIndex: 1,
  pageSize: 10,
  assignRuleVersion: '',
  rounds: '',
});

console.log(JSON.stringify({ planName, planNameEdit, attempts, created, id, search: search.body, updateAttempts, deleteAttempts, searchAfter: searchAfter.body }, null, 2));
