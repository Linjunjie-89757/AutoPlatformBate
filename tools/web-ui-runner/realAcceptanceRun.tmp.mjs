import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const outputDir = 'output/playwright';
const appUrl = 'http://localhost:4173';
const apiBaseUrl = 'http://localhost:8080/api';
const runnerBaseUrl = 'http://127.0.0.1:39118';
const workspaceCode = 'account-open';
const targetCaseName = process.env.TARGET_CASE_NAME || 'Codex Manual Locator E2E';

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const logs = [];
page.on('console', message => logs.push({ type: message.type(), text: message.text() }));
page.on('pageerror', error => logs.push({ type: 'pageerror', text: error.message }));

try {
  await login(page);

  await callRunner('/tasks/poll/stop', {});
  await callRunner('/session/release', {});
  const runnerHealth = await callRunner('/health', null, 'GET');
  const pollStart = await callRunner('/tasks/poll/start', {
    apiBaseUrl,
    installId: 'real-acceptance',
    capabilities: ['WEB_CASE_RUN', 'WEB_ELEMENT_VALIDATE'],
    workspaceCodes: [workspaceCode],
    intervalMs: 1000,
  });

  const cases = await api(page, `/automation/web/cases?page=1&size=20`, { method: 'GET' });
  const items = cases.data?.records || cases.data?.items || [];
  const target = items.find(item => String(item.name || item.caseName || '').includes(targetCaseName))
    || items.find(item => Number(item.stepsCount || item.stepCount || 0) > 0 && String(item.lastResult || '').toUpperCase() === 'SUCCESS')
    || items.find(item => Number(item.stepsCount || item.stepCount || 0) > 0);
  if (!target) {
    throw new Error('没有找到可用于本地运行验收的 Web UI 用例');
  }
  const caseId = Number(target.id || target.caseId);

  const localRun = await api(page, `/automation/web/cases/${caseId}/local-runner-run`, {
    method: 'POST',
    body: {},
  });
  const runnerTask = localRun.data?.runnerTask;
  const formalRun = localRun.data?.run;
  const runId = runnerTask?.runId;
  const formalRunId = formalRun?.runId;
  if (!runId || !formalRunId) {
    throw new Error(`本地运行任务创建失败：${JSON.stringify(localRun)}`);
  }

  const finalTask = await waitFor(async () => {
    const task = await api(page, `/local-runner/tasks/${encodeURIComponent(runId)}`, { method: 'GET' });
    const status = String(task.data?.status || '').toUpperCase();
    if (['SUCCESS', 'FAILED', 'CANCELED', 'TIMEOUT'].includes(status)) {
      return task.data;
    }
    return null;
  }, 60000, '本地运行任务未在 60s 内结束');

  const runDetail = await waitFor(async () => {
    const detail = await api(page, `/automation/web/runs/${formalRunId}`, { method: 'GET' });
    const summary = detail.data?.summary || detail.data;
    const status = String(summary?.status || '').toUpperCase();
    if (status && status !== 'RUNNING' && status !== 'PENDING') {
      return detail.data;
    }
    return null;
  }, 30000, '正式报告未在 30s 内完成');

  await page.goto(`${appUrl}/automation/web/runs?workspace=${workspaceCode}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outputDir}/real-acceptance-local-run-result.png`, fullPage: true });

  console.log(JSON.stringify({
    success: String(finalTask.status).toUpperCase() === 'SUCCESS',
    runnerHealth,
    pollStart,
    case: {
      id: caseId,
      name: target.name || target.caseName,
      previousResult: target.lastResult || null,
    },
    runnerTask: {
      runId,
      status: finalTask.status,
      progress: finalTask.progress,
      errorMessage: finalTask.errorMessage || null,
      statusMessage: finalTask.statusMessage || null,
    },
    formalRun: {
      runId: formalRunId,
      status: runDetail.summary?.status || runDetail.status || null,
      totalSteps: runDetail.summary?.totalSteps ?? null,
      passedSteps: runDetail.summary?.passedSteps ?? null,
      failedSteps: runDetail.summary?.failedSteps ?? null,
      skippedSteps: runDetail.summary?.skippedSteps ?? null,
    },
    screenshot: `${outputDir}/real-acceptance-local-run-result.png`,
    logs: logs.slice(-30),
  }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${outputDir}/real-acceptance-local-run-error.png`, fullPage: true }).catch(() => {});
  console.error(JSON.stringify({ success: false, error: error.message, logs: logs.slice(-50) }, null, 2));
  process.exitCode = 1;
} finally {
  await callRunner('/tasks/poll/stop', {}).catch(() => {});
  await browser.close();
}

async function login(page) {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  if (await page.locator('input[type="password"]').count()) {
    const inputs = page.locator('input:not([type="hidden"])');
    await inputs.nth(0).fill('zhangli');
    await inputs.nth(1).fill('123456');
    await page.getByRole('button', { name: /登录|Login/i }).click();
    await page.waitForTimeout(2500);
  }
  await page.goto(`${appUrl}/automation/web/cases?workspace=${workspaceCode}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  if (await page.locator('input[type="password"]').count()) {
    throw new Error('登录后仍停留在登录页');
  }
}

async function api(page, path, options = {}) {
  return page.evaluate(async ({ apiBaseUrl, path, workspaceCode, options }) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method || 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Code': workspaceCode,
        ...(options.headers || {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }
    if (!response.ok || payload?.success === false) {
      throw new Error(`API ${options.method || 'GET'} ${path} failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return payload;
  }, { apiBaseUrl, path, workspaceCode, options });
}

async function callRunner(path, body, method = 'POST') {
  const response = await fetch(`${runnerBaseUrl}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(`Runner ${method} ${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function waitFor(fn, timeoutMs, message) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw lastError || new Error(message);
}
