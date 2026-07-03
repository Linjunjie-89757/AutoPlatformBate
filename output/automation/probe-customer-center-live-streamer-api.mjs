const baseUrl = 'https://japi-test.integrity.com.cn';
const account = '19966468884';
const password = 'Shitao123@';
const tag = Date.now().toString().slice(-8);
const liveStreamerName = `AUTO_ANCHOR_${tag}`;
const liveStreamerNameEdit = `AUTO_ANCHOR_E_${tag}`;
const liveStreamerCode = `auto_anchor_${tag}`;
const mobile = `139${tag}`;

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

async function login() {
  const loginResult = await request('/user-auth/auth/v1/back-unified-login/by-pwd', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account, pwdKey: password }),
  });
  if (!loginResult.response.ok) throw new Error(loginResult.text);
  const verifyResult = await request('/system-admin/auth/v1/secret-token/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secretToken: loginResult.body.data.secretToken }),
  });
  if (!verifyResult.response.ok) throw new Error(verifyResult.text);
  return verifyResult.body.data.accessToken;
}

async function api(accessToken, method, path, body = null) {
  return request(path, {
    method,
    headers: { 'content-type': 'application/json', 'access-token': accessToken },
    body: body == null ? undefined : JSON.stringify(body),
  });
}

const accessToken = await login();
const baseBody = {
  liveStreamerName,
  liveStreamerCode,
  avatar: '',
  mobile,
  categoryCode: '1',
  type: 0,
  operationTag: '',
  hireDate: Date.UTC(2026, 6, 1),
  resignationDate: '',
  practicingQualificationCode: `AUTO_CERT_${tag}`,
  teamId: '1930150017539706882',
  officeCode: 'ZHYT_XS',
  userCode: 'A2506001_80uf',
  sourceChannel: '',
  operationManager: 'A2506001_80uf',
  operator: 'A2506001_80uf',
  enableFlag: 1,
};

const attempts = [];
let created = null;
for (const candidate of [
  { method: 'POST', path: '/traffic-admin/admin/v1/live-streamer/add', body: baseBody },
  { method: 'POST', path: '/traffic-admin/admin/v1/live-streamer/save', body: baseBody },
  { method: 'POST', path: '/traffic-admin/admin/v1/live-streamer/saveOrUpdate', body: baseBody },
]) {
  const result = await api(accessToken, candidate.method, candidate.path, candidate.body);
  attempts.push({ method: candidate.method, path: candidate.path, status: result.response.status, body: result.body });
  if (result.response.ok && result.body?.msg === 'success') {
    created = { candidate, body: result.body };
    break;
  }
}

const search = await api(accessToken, 'POST', '/traffic-admin/admin/v1/live-streamer/view-list', {
  pageIndex: 1,
  pageSize: 10,
  liveStreamerName,
  liveStreamerCode: '',
  organizationId: '',
  teamId: '',
  officeCode: '',
  enableFlag: '',
});
const record = search.body?.data?.records?.[0];
const id = record?.id;
const updateAttempts = [];
const disableAttempts = [];
const deleteAttempts = [];

if (id) {
  const updateBody = { ...baseBody, id, liveStreamerName: liveStreamerNameEdit };
  for (const candidate of [
    { method: 'POST', path: '/traffic-admin/admin/v1/live-streamer/update', body: updateBody },
    { method: 'POST', path: '/traffic-admin/admin/v1/live-streamer/add', body: updateBody },
    { method: 'POST', path: '/traffic-admin/admin/v1/live-streamer/saveOrUpdate', body: updateBody },
  ]) {
    const result = await api(accessToken, candidate.method, candidate.path, candidate.body);
    updateAttempts.push({ method: candidate.method, path: candidate.path, status: result.response.status, body: result.body });
    if (result.response.ok && result.body?.msg === 'success') break;
  }

  for (const candidate of [
    { method: 'POST', path: `/traffic-admin/admin/v1/live-streamer/switchEnableFlag/${id}/0`, body: {} },
    { method: 'POST', path: '/traffic-admin/admin/v1/live-streamer/switchEnableFlag', body: { id, enableFlag: 0 } },
    { method: 'POST', path: '/traffic-admin/admin/v1/live-streamer/updateEnableFlag', body: { id, enableFlag: 0 } },
  ]) {
    const result = await api(accessToken, candidate.method, candidate.path, candidate.body);
    disableAttempts.push({ method: candidate.method, path: candidate.path, status: result.response.status, body: result.body });
    if (result.response.ok && result.body?.msg === 'success') break;
  }

  for (const candidate of [
    { method: 'POST', path: '/traffic-admin/admin/v1/live-streamer/delete', body: { id } },
    { method: 'DELETE', path: `/traffic-admin/admin/v1/live-streamer/delete/${id}`, body: null },
    { method: 'POST', path: `/traffic-admin/admin/v1/live-streamer/delete/${id}`, body: {} },
  ]) {
    const result = await api(accessToken, candidate.method, candidate.path, candidate.body);
    deleteAttempts.push({ method: candidate.method, path: candidate.path, status: result.response.status, body: result.body });
    if (result.response.ok && result.body?.msg === 'success') break;
  }
}

const searchAfter = await api(accessToken, 'POST', '/traffic-admin/admin/v1/live-streamer/view-list', {
  pageIndex: 1,
  pageSize: 10,
  liveStreamerName: liveStreamerNameEdit,
  liveStreamerCode: '',
  organizationId: '',
  teamId: '',
  officeCode: '',
  enableFlag: '',
});

console.log(JSON.stringify({
  liveStreamerName,
  liveStreamerNameEdit,
  liveStreamerCode,
  mobile,
  attempts,
  created,
  search: search.body,
  record,
  updateAttempts,
  disableAttempts,
  deleteAttempts,
  searchAfter: searchAfter.body,
}, null, 2));
