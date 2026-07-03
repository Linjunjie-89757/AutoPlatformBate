const baseUrl = 'https://japi-test.integrity.com.cn';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${text}`);
  return body;
}

async function login() {
  const loginBody = await request('/user-auth/auth/v1/back-unified-login/by-pwd', {
    method: 'POST',
    body: JSON.stringify({ account: '19966468884', pwdKey: 'Shitao123@' }),
  });
  const verifyBody = await request('/system-admin/auth/v1/secret-token/verify', {
    method: 'POST',
    body: JSON.stringify({ secretToken: loginBody.data.secretToken }),
  });
  return verifyBody.data.accessToken;
}

async function main() {
  const token = await login();
  const headers = { 'access-token': token };
  const restore = await request('/order-admin/admin/refund/agreementConfig/saveOrUpdate', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: 2,
      name: '退款及保密协议',
      template: '<p>23423423432</p>',
    }),
  });
  const enable = await request('/order-admin/admin/refund/agreementConfig/updateEnable/2/1', {
    method: 'GET',
    headers,
  });
  const list = await request('/order-admin/admin/refund/agreementConfig/list', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  console.log(JSON.stringify({ restore, enable, id2: list.data?.find((item) => String(item.id) === '2') }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
