export const LOCAL_RUNNER_BASE_URL = 'http://127.0.0.1:39118';
export const LOCAL_RUNNER_START_COMMAND = 'cd D:\\perfectproject\\newautoweb\\perfectprojectwebchonggou-main && npm.cmd run runner';
export const LOCAL_RUNNER_INSTALL_CHROMIUM_COMMAND = 'npx playwright install chromium';

export function buildLocalRunnerStatusView(input = {}) {
  const health = input.health || null;
  const currentUrl = health?.currentUrl || null;
  const runnerVersion = health?.runnerVersion && health.runnerVersion !== '-' ? health.runnerVersion : null;

  if (input.checking) {
    return createStatus({
      kind: 'CHECKING',
      tagType: 'info',
      alertType: 'info',
      label: '检测中',
      title: '正在检测本地调试环境',
      description: '正在读取本地 Runner、浏览器内核和当前页面状态。',
      currentUrl,
      runnerVersion,
    });
  }

  if (!health?.online) {
    const reason = input.errorMessage ? `当前错误：${input.errorMessage}` : `无法访问 ${LOCAL_RUNNER_BASE_URL}/health。`;
    return createStatus({
      kind: 'OFFLINE',
      tagType: 'danger',
      alertType: 'error',
      label: '未连接',
      title: '本地调试 Runner 未启动或无法访问',
      description: `${reason} 请在前端项目目录启动本地 Runner，然后重新检测。`,
      commands: [LOCAL_RUNNER_START_COMMAND],
      currentUrl: null,
      runnerVersion: null,
    });
  }

  if (!health.playwrightAvailable) {
    return createStatus({
      kind: 'PLAYWRIGHT_MISSING',
      tagType: 'warning',
      alertType: 'warning',
      label: '依赖缺失',
      title: '本地 Runner 已连接，但 Playwright 不可用',
      description: '请先安装前端依赖，确认当前项目可以加载 playwright 包，再重新启动 Runner。',
      commands: ['npm.cmd install', LOCAL_RUNNER_START_COMMAND],
      currentUrl,
      runnerVersion,
    });
  }

  if (!health.chromiumInstalled) {
    return createStatus({
      kind: 'CHROMIUM_MISSING',
      tagType: 'warning',
      alertType: 'warning',
      label: '浏览器缺失',
      title: '本地 Runner 已连接，但 Chromium 未安装',
      description: '请安装 Playwright 的 Chromium 浏览器内核，安装后重新启动 Runner。',
      commands: [LOCAL_RUNNER_INSTALL_CHROMIUM_COMMAND, LOCAL_RUNNER_START_COMMAND],
      currentUrl,
      runnerVersion,
    });
  }

  if (!currentUrl) {
    return createStatus({
      kind: 'NO_PAGE',
      tagType: 'warning',
      alertType: 'warning',
      label: '未打开页面',
      title: '请先打开目标业务页面',
      description: '可以填写页面 URL 后点击“打开页面”，也可以在本地浏览器里手动进入目标页面。',
      currentUrl,
      runnerVersion,
      canOpenPage: true,
    });
  }

  if (isProbablyLoginUrl(currentUrl)) {
    return createStatus({
      kind: 'LOGIN_PAGE',
      tagType: 'warning',
      alertType: 'warning',
      label: '疑似登录页',
      title: '当前页面可能是登录页',
      description: '登录页不作为采集目标。请先完成登录，再进入要采集的业务页面。',
      currentUrl,
      runnerVersion,
      canOpenPage: true,
    });
  }

  const expectedUrl = input.expectedUrl?.trim();
  if (expectedUrl && normalizeComparableUrl(currentUrl) !== normalizeComparableUrl(expectedUrl)) {
    return createStatus({
      kind: 'URL_MISMATCH',
      tagType: 'warning',
      alertType: 'warning',
      label: '页面不一致',
      title: '当前页面和目标地址不一致',
      description: '采集会以本地浏览器当前页面为准。如果这不是目标业务页面，请重新打开或手动切回正确页面。',
      currentUrl,
      runnerVersion,
      canOpenPage: true,
      canCollect: true,
    });
  }

  return createStatus({
    kind: 'READY',
    tagType: 'success',
    alertType: 'success',
    label: '可采集',
    title: '当前页面可采集',
    description: `将采集当前页面：${currentUrl}`,
    currentUrl,
    runnerVersion,
    canOpenPage: true,
    canCollect: true,
  });
}

function createStatus(input) {
  return {
    commands: [],
    currentUrl: null,
    runnerVersion: null,
    canOpenPage: false,
    canCollect: false,
    ...input,
  };
}

function normalizeComparableUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return String(url || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .split(/[?#]/)[0]
      .replace(/\/+$/, '')
      .toLowerCase();
  }
}

function isProbablyLoginUrl(url) {
  return /login|signin|auth|passport|sso/i.test(url);
}
