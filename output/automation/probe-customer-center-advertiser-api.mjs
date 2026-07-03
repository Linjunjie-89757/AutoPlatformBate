const baseUrl = 'https://japi-test.integrity.com.cn';
const account = '19966468884';
const password = 'Shitao123@';
const tag = Date.now().toString().slice(-8);
const advertiserId = `99${tag}`;
const advertiserName = `AUTO_ADV_${tag}`;
const advertiserNameEdit = `AUTO_ADV_E_${tag}`;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${text}`);
  }
  return body;
}

async function login() {
  const loginBody = await request('/user-auth/auth/v1/back-unified-login/by-pwd', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account, pwdKey: password }),
  });
  const verifyBody = await request('/system-admin/auth/v1/secret-token/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secretToken: loginBody.data.secretToken }),
  });
  return verifyBody.data.accessToken;
}

async function api(accessToken, path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'access-token': accessToken },
    body: JSON.stringify(body),
  });
}

const accessToken = await login();
const addBody = {
  platform: 'ocean_engine',
  advertiserId,
  advertiserName,
  addTime: Date.now(),
  officeCode: 'ZHYT_XS09',
  enableFlag: 1,
};
const add = await api(accessToken, '/traffic-admin/admin/v1/ad-advertiser/add', addBody);
const search = await api(accessToken, '/traffic-admin/admin/v1/ad-advertiser/search', {
  pageIndex: 1,
  pageSize: 10,
  advertiserId,
  advertiserName: '',
  platform: '',
  enableFlag: '',
});
const id = search?.data?.records?.[0]?.id;
if (!id) throw new Error(`missing advertiser id: ${JSON.stringify(search)}`);

const updateBody = { ...addBody, id, advertiserName: advertiserNameEdit };
const update = await api(accessToken, '/traffic-admin/admin/v1/ad-advertiser/update', updateBody);
const searchEdit = await api(accessToken, '/traffic-admin/admin/v1/ad-advertiser/search', {
  pageIndex: 1,
  pageSize: 10,
  advertiserId,
  advertiserName: advertiserNameEdit,
  platform: '',
  enableFlag: '',
});
const del = await api(accessToken, '/traffic-admin/admin/v1/ad-advertiser/delete', { id });
const searchDeleted = await api(accessToken, '/traffic-admin/admin/v1/ad-advertiser/search', {
  pageIndex: 1,
  pageSize: 10,
  advertiserId,
  advertiserName: '',
  platform: '',
  enableFlag: '',
});

console.log(JSON.stringify({ advertiserId, advertiserName, advertiserNameEdit, add, id, update, searchEdit, del, searchDeleted }, null, 2));
