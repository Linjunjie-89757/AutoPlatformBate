const baseUrl = 'https://japi-test.integrity.com.cn';

const json = (value) => JSON.stringify(value, null, 2);

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const response = await fetch(url, {
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
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${text.slice(0, 500)}`);
  }
  return body;
}

async function login() {
  const loginBody = await request('/user-auth/auth/v1/back-unified-login/by-pwd', {
    method: 'POST',
    body: json({ account: '19966468884', pwdKey: 'Shitao123@' }),
  });
  const secretToken = loginBody?.data?.secretToken;
  if (!secretToken) throw new Error(`missing secretToken: ${json(loginBody)}`);

  const verifyBody = await request('/system-admin/auth/v1/secret-token/verify', {
    method: 'POST',
    body: json({ secretToken }),
  });
  const accessToken = verifyBody?.data?.accessToken;
  if (!accessToken) throw new Error(`missing accessToken: ${json(verifyBody)}`);
  return accessToken;
}

function firstRecord(body) {
  return body?.data?.records?.[0] || body?.data?.list?.[0] || body?.data?.[0] || null;
}

async function api(token, method, path, body) {
  const result = await request(path, {
    method,
    headers: { 'access-token': token },
    body: method === 'GET' ? undefined : json(body ?? {}),
  });
  if (result?.msg !== 'success') {
    throw new Error(`${method} ${path} msg=${result?.msg}: ${json(result).slice(0, 1000)}`);
  }
  return result;
}

async function probeCommoditySpec(token, tag) {
  const shortTag = tag.slice(-8);
  const commodityName = `AUTO_SPEC_${shortTag}`;
  const indicatorName = `SP_${shortTag}`;
  const indicatorNameEdit = `SE_${shortTag}`;

  console.log('\n[spec] create');
  console.log(json(await api(token, 'POST', '/order-admin/admin/commodity/saveOrUpdate', {
    commodityName,
    itemId: '56',
    commodityIndicatorList: [{
      indicatorName,
      unitValue: 1,
      price: 0.01,
      riskLevel: 1,
      indicatorStatus: 1,
    }],
  })));

  const page = await api(token, 'POST', '/order-admin/admin/commodity/page', {
    pageIndex: 1,
    pageSize: 10,
    commodityId: '',
    commodityName,
    indicatorName: '',
    indicatorStatus: 1,
  });
  const record = firstRecord(page);
  console.log('[spec] page record', json(record));
  const commodityId = record?.commodityId || record?.id;
  const indicatorId = record?.indicatorId || record?.commodityIndicatorList?.[0]?.indicatorId;
  if (!commodityId) throw new Error(`missing commodityId: ${json(page)}`);

  const detail = await api(token, 'GET', `/order-admin/admin/commodity/detail/${commodityId}`);
  console.log('[spec] detail', json(detail?.data).slice(0, 1500));
  const detailIndicator = detail?.data?.commodityIndicatorList?.[0] || {};
  const resolvedIndicatorId = indicatorId || detailIndicator.indicatorId;

  console.log('[spec] edit');
  console.log(json(await api(token, 'POST', '/order-admin/admin/commodity/saveOrUpdate', {
    commodityId,
    commodityName,
    itemId: '56',
    commodityIndicatorList: [{
      indicatorId: resolvedIndicatorId,
      indicatorName: indicatorNameEdit,
      unitValue: 2,
      price: 0.02,
      riskLevel: 1,
      indicatorStatus: 2,
    }],
  })));

  const verify = await api(token, 'POST', '/order-admin/admin/commodity/page', {
    pageIndex: 1,
    pageSize: 10,
    commodityId,
    commodityName,
    indicatorName: indicatorNameEdit,
    indicatorStatus: 2,
  });
  console.log('[spec] verify', json(firstRecord(verify)));
}

async function probeActivity(token, tag) {
  const shortTag = tag.slice(-8);
  const activityName = `AUTO_ACT_${shortTag}`;
  const activityNameEdit = `AUTO_ACT_E_${shortTag}`;
  const payload = {
    activityName,
    dept1Code: 'ZHYT_XS09',
    activityStartDate: '2026-06-28T16:00:00.000Z',
    activityEndDate: '2026-06-29T16:00:00.000Z',
    thirdActivityId: '',
    remark: `AUTO ${tag}`,
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
  };

  console.log('\n[activity] create');
  console.log(json(await api(token, 'POST', '/order-admin/admin/commodity/activity/saveOrUpdate', payload)));

  const page = await api(token, 'POST', '/order-admin/admin/commodity/activity/page', {
    pageIndex: 1,
    pageSize: 10,
    activityName,
    activityEndDateStart: '',
    activityEndDateEnd: '',
    activityStatus: 1,
    dept1Code: '',
  });
  const record = firstRecord(page);
  console.log('[activity] page record', json(record));
  const activityId = record?.activityId || record?.id;
  if (!activityId) throw new Error(`missing activityId: ${json(page)}`);

  const detail = await api(token, 'GET', `/order-admin/admin/commodity/activity/detail/${activityId}`);
  console.log('[activity] detail', json(detail?.data).slice(0, 1500));

  console.log('[activity] disable');
  console.log(json(await api(token, 'GET', `/order-admin/admin/commodity/activity/updateEnable/${activityId}/2`)));

  console.log('[activity] edit after disable');
  console.log(json(await api(token, 'POST', '/order-admin/admin/commodity/activity/saveOrUpdate', {
    ...payload,
    activityId,
    activityName: activityNameEdit,
    remark: `AUTO EDIT ${tag}`,
  })));

  const verify = await api(token, 'POST', '/order-admin/admin/commodity/activity/page', {
    pageIndex: 1,
    pageSize: 10,
    activityName: activityNameEdit,
    activityEndDateStart: '',
    activityEndDateEnd: '',
    activityStatus: 2,
    dept1Code: '',
  });
  console.log('[activity] verify', json(firstRecord(verify)));
}

async function probeRefundAgreement(token, tag) {
  const shortTag = tag.slice(-8);
  const name = `AUTO_REFUND_${shortTag}`;
  const nameEdit = `AUTO_REFUND_E_${shortTag}`;
  const template = `<p>auto ${tag}</p>`;

  console.log('\n[refund-agreement] create');
  console.log(json(await api(token, 'POST', '/order-admin/admin/refund/agreementConfig/saveOrUpdate', {
    id: 0,
    name,
    template,
  })));

  const page = await api(token, 'POST', '/order-admin/admin/refund/agreementConfig/list', {});
  console.log('[refund-agreement] list sample', json(page).slice(0, 3000));
  const list = Array.isArray(page?.data) ? page.data : page?.data?.records || [];
  const record = list.find((item) => item?.name === name || item?.agreementName === name) || firstRecord(page);
  console.log('[refund-agreement] record', json(record));
  const id = record?.id;
  if (!id) throw new Error(`missing refund agreement id: ${json(page)}`);

  console.log('[refund-agreement] edit');
  console.log(json(await api(token, 'POST', '/order-admin/admin/refund/agreementConfig/saveOrUpdate', {
    id,
    name: nameEdit,
    template: `<p>auto edit ${tag}</p>`,
  })));

  console.log('[refund-agreement] disable');
  console.log(json(await api(token, 'GET', `/order-admin/admin/refund/agreementConfig/updateEnable/${id}/2`)));
}

async function probeQuestionnaire(token, tag) {
  const shortTag = tag.slice(-8);
  const name = `AUTO_QUES_${shortTag}`;
  const nameEdit = `AUTO_QUES_E_${shortTag}`;

  console.log('\n[questionnaire] create');
  console.log(json(await api(token, 'POST', '/order-admin/admin/questionnaire/manage/saveOrUpdate', {
    questionnaireId: '',
    questionnaireName: name,
    questionnaireExplain: `AUTO ${tag}`,
    questionnaireType: 1,
  })));

  const page = await api(token, 'POST', '/order-admin/admin/questionnaire/manage/list', {
    pageIndex: 1,
    pageSize: 50,
    questionnaireId: '',
    questionnaireName: '',
    questionnaireStatus: '',
    questionnaireType: '',
  });
  console.log('[questionnaire] list sample', json(page).slice(0, 3000));
  const records = page?.data?.records || [];
  const record = records.find((item) => item?.questionnaireName === name) || null;
  console.log('[questionnaire] record', json(record));
  const id = record?.questionnaireId || record?.id;
  if (!id) throw new Error(`missing questionnaire id: ${json(page)}`);

  console.log('[questionnaire] detail');
  console.log(json(await api(token, 'GET', `/order-admin/admin/questionnaire/manage/queryDetail/${id}`)).slice(0, 1500));

  console.log('[questionnaire] edit');
  console.log(json(await api(token, 'POST', '/order-admin/admin/questionnaire/manage/saveOrUpdate', {
    questionnaireId: id,
    questionnaireName: nameEdit,
    questionnaireExplain: `AUTO EDIT ${tag}`,
    questionnaireType: 1,
  })));

  console.log('[questionnaire] disable');
  console.log(json(await api(token, 'GET', `/order-admin/admin/questionnaire/manage/updateEnable/${id}/2`)));
}

async function main() {
  const tag = Date.now().toString();
  const token = await login();
  console.log('[login] ok');
  const only = new Set((process.env.PROBE_ONLY || 'spec,activity,refund,questionnaire').split(','));
  if (only.has('spec')) await probeCommoditySpec(token, tag);
  if (only.has('activity')) await probeActivity(token, tag);
  if (only.has('refund')) await probeRefundAgreement(token, tag);
  if (only.has('questionnaire')) await probeQuestionnaire(token, tag);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
