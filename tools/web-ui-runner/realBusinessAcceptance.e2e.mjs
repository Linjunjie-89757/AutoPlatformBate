import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const OUTPUT_DIR = 'output/playwright';
const APP_URL = process.env.LOCAL_RUNNER_ACCEPTANCE_APP_URL || 'http://localhost:4173';
const API_BASE_URL = process.env.LOCAL_RUNNER_ACCEPTANCE_API_URL || 'http://localhost:8080/api';
const RUNNER_BASE_URL = process.env.LOCAL_RUNNER_ACCEPTANCE_RUNNER_URL || 'http://127.0.0.1:39118';
const WORKSPACE_CODE = process.env.LOCAL_RUNNER_ACCEPTANCE_WORKSPACE || 'account-open';
const USERNAME = process.env.LOCAL_RUNNER_ACCEPTANCE_USERNAME || 'zhangli';
const PASSWORD = process.env.LOCAL_RUNNER_ACCEPTANCE_PASSWORD || '';
const HEADLESS = process.env.LOCAL_RUNNER_ACCEPTANCE_HEADLESS === 'true';

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const logs = [];
  page.on('console', message => logs.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => logs.push({ type: 'pageerror', text: error.message }));

  try {
    await login(page);
    await resetRunnerState();
    const runnerHealth = await runnerRequest('/health', null, 'GET');
    assert.equal(runnerHealth.success, true, 'local runner health check failed');

    const ordinary = await runOrdinaryCase(page);
    const upload = await runUploadArtifactCase(page);

    await page.goto(`${APP_URL}/automation/web/runs?workspace=${WORKSPACE_CODE}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUTPUT_DIR}/real-business-acceptance-result.png`, fullPage: true });

    console.log(JSON.stringify({
      success: true,
      appUrl: APP_URL,
      apiBaseUrl: API_BASE_URL,
      runnerBaseUrl: RUNNER_BASE_URL,
      workspaceCode: WORKSPACE_CODE,
      headed: !HEADLESS,
      scenarios: [ordinary, upload],
      screenshot: `${OUTPUT_DIR}/real-business-acceptance-result.png`,
      logs: logs.slice(-30),
    }, null, 2));
  } catch (error) {
    await page.screenshot({ path: `${OUTPUT_DIR}/real-business-acceptance-error.png`, fullPage: true }).catch(() => {});
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      logs: logs.slice(-50),
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await resetRunnerState();
    await browser.close();
  }
}

async function runOrdinaryCase(page) {
  await resetRunnerState();
  await startPolling('real-business-ordinary');

  const fixtureUrl = await createOrdinaryFixture();
  const created = await api(page, '/automation/web/cases', {
    method: 'POST',
    body: {
      workspaceCode: WORKSPACE_CODE,
      moduleName: 'codex-real-acceptance',
      caseName: `Codex Real Ordinary Acceptance ${Date.now()}`,
      description: 'Local Runner real business acceptance case for ordinary click replay.',
      baseUrl: '',
      browserType: 'chromium',
      headless: HEADLESS,
      defaultTimeoutMs: 5000,
      status: 'enabled',
      steps: [
        {
          stepName: 'Open ordinary fixture',
          stepType: 'OPEN',
          inputValue: fixtureUrl,
          enabled: true,
          sortOrder: 1,
        },
        {
          stepName: 'Click action button',
          stepType: 'CLICK',
          locatorType: 'CSS',
          locatorValue: '#acceptance-action',
          enabled: true,
          sortOrder: 2,
        },
        {
          stepName: 'Assert action result',
          stepType: 'ASSERT_TEXT',
          locatorType: 'CSS',
          locatorValue: '#acceptance-status',
          inputValue: 'Clicked by Local Runner',
          enabled: true,
          sortOrder: 3,
        },
      ],
    },
  });

  const result = await runLocalCaseAndWait(page, Number(created.data?.id));
  assert.equal(result.runnerTask.status, 'SUCCESS', 'ordinary local runner task failed');
  assert.equal(result.formalRun.status, 'SUCCESS', 'ordinary formal run failed');
  assert.equal(result.formalRun.totalSteps, 3, 'ordinary case step count changed');
  assert.equal(result.formalRun.passedSteps, 3, 'ordinary case did not pass all steps');

  return {
    name: 'ordinary-web-case-run',
    fixtureUrl,
    caseId: Number(created.data?.id),
    caseName: created.data?.caseName,
    ...result,
  };
}

async function runUploadArtifactCase(page) {
  await resetRunnerState();
  await startPolling('real-business-upload');

  const fixtureUrl = await createUploadFixture();
  const fileId = `upload-acceptance-${Date.now()}`;
  const fileName = 'acceptance-upload.txt';
  const fileContent = 'local runner upload acceptance';
  const contentBase64 = Buffer.from(fileContent, 'utf8').toString('base64');
  const created = await api(page, '/automation/web/cases', {
    method: 'POST',
    body: {
      workspaceCode: WORKSPACE_CODE,
      moduleName: 'codex-real-acceptance',
      caseName: `Codex Real Upload Acceptance ${Date.now()}`,
      description: 'Local Runner real business acceptance case for saved upload artifact binding.',
      baseUrl: '',
      browserType: 'chromium',
      headless: HEADLESS,
      defaultTimeoutMs: 5000,
      status: 'enabled',
      steps: [
        {
          stepName: 'Open upload fixture',
          stepType: 'OPEN',
          inputValue: fixtureUrl,
          enabled: true,
          sortOrder: 1,
        },
        {
          stepName: 'Upload saved artifact',
          stepType: 'FILE_UPLOAD',
          locatorType: 'CSS',
          locatorValue: '#fixture-upload',
          inputValue: `artifact:${fileId}`,
          uploadArtifactBinding: {
            fileId,
            fileName,
            contentType: 'text/plain',
            contentBase64,
            size: Buffer.byteLength(fileContent),
          },
          enabled: true,
          sortOrder: 2,
        },
        {
          stepName: 'Assert uploaded file name',
          stepType: 'ASSERT_TEXT',
          locatorType: 'CSS',
          locatorValue: '#upload-status',
          inputValue: fileName,
          enabled: true,
          sortOrder: 3,
        },
      ],
    },
  });

  const caseId = Number(created.data?.id);
  const detail = await api(page, `/automation/web/cases/${caseId}`, { method: 'GET' });
  const savedUpload = (detail.data?.steps || []).find(step => String(step.stepType).toUpperCase() === 'FILE_UPLOAD');
  assert.equal(savedUpload?.uploadArtifactBinding?.contentBase64, contentBase64, 'saved upload binding was not persisted');

  const result = await runLocalCaseAndWait(page, caseId);
  const artifactRefs = result.artifactRefs || [];
  assert.equal(result.runnerTask.status, 'SUCCESS', 'upload local runner task failed');
  assert.equal(result.formalRun.status, 'SUCCESS', 'upload formal run failed');
  assert.equal(result.formalRun.totalSteps, 3, 'upload case step count changed');
  assert.equal(result.formalRun.passedSteps, 3, 'upload case did not pass all steps');
  assert.ok(
    artifactRefs.some(ref => ref.fileId === fileId && ref.contentBase64 === contentBase64),
    'saved upload binding was not converted to runner artifactRefs',
  );

  return {
    name: 'upload-artifact-web-case-run',
    fixtureUrl,
    caseId,
    caseName: created.data?.caseName,
    uploadArtifact: {
      fileId,
      fileName,
      contentBase64,
    },
    ...result,
  };
}

async function runLocalCaseAndWait(page, caseId) {
  const localRun = await api(page, `/automation/web/cases/${caseId}/local-runner-run`, {
    method: 'POST',
    body: {},
  });
  const runnerRunId = localRun.data?.runnerTask?.runId;
  const formalRunId = localRun.data?.run?.runId;
  assert.ok(runnerRunId, 'local runner task id was not returned');
  assert.ok(formalRunId, 'formal run id was not returned');

  const finalTask = await waitFor(async () => {
    const task = await api(page, `/local-runner/tasks/${encodeURIComponent(runnerRunId)}`, { method: 'GET' });
    const status = String(task.data?.status || '').toUpperCase();
    return ['SUCCESS', 'FAILED', 'CANCELED', 'TIMEOUT'].includes(status) ? task.data : null;
  }, 60000, `runner task ${runnerRunId} did not finish in 60s`);

  const runDetail = await waitFor(async () => {
    const detail = await api(page, `/automation/web/runs/${formalRunId}`, { method: 'GET' });
    const summary = detail.data?.summary || detail.data;
    const status = String(summary?.status || '').toUpperCase();
    return status && status !== 'RUNNING' && status !== 'PENDING' ? detail.data : null;
  }, 30000, `formal run ${formalRunId} did not finish in 30s`);

  return {
    artifactRefs: localRun.data?.runnerTask?.envelope?.artifactRefs || [],
    runnerTask: {
      runId: runnerRunId,
      status: String(finalTask.status || '').toUpperCase(),
      statusMessage: finalTask.statusMessage || null,
      errorMessage: finalTask.errorMessage || null,
      progress: finalTask.progress || null,
    },
    formalRun: {
      runId: formalRunId,
      status: String(runDetail.summary?.status || runDetail.status || '').toUpperCase(),
      totalSteps: runDetail.summary?.totalSteps ?? null,
      passedSteps: runDetail.summary?.passedSteps ?? null,
      failedSteps: runDetail.summary?.failedSteps ?? null,
      skippedSteps: runDetail.summary?.skippedSteps ?? null,
    },
  };
}

async function createOrdinaryFixture() {
  const path = resolve(OUTPUT_DIR, 'local-runner-ordinary-acceptance.html');
  await writeFile(path, `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Local Runner Ordinary Acceptance</title></head>
  <body>
    <button id="acceptance-action" type="button">Run action</button>
    <p id="acceptance-status">Waiting</p>
    <script>
      document.getElementById('acceptance-action').addEventListener('click', () => {
        document.getElementById('acceptance-status').textContent = 'Clicked by Local Runner';
      });
    </script>
  </body>
</html>
`, 'utf8');
  return pathToFileURL(path).href;
}

async function createUploadFixture() {
  const path = resolve(OUTPUT_DIR, 'local-runner-upload-acceptance.html');
  await writeFile(path, `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Local Runner Upload Acceptance</title></head>
  <body>
    <label for="fixture-upload">Upload fixture</label>
    <input id="fixture-upload" type="file">
    <p id="upload-status">Waiting for upload</p>
    <script>
      document.getElementById('fixture-upload').addEventListener('change', event => {
        const file = event.target.files && event.target.files[0];
        document.getElementById('upload-status').textContent = file ? file.name : 'No file selected';
      });
    </script>
  </body>
</html>
`, 'utf8');
  return pathToFileURL(path).href;
}

async function login(page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  if (await page.locator('input[type="password"]').count()) {
    if (!PASSWORD) {
      throw new Error('LOCAL_RUNNER_ACCEPTANCE_PASSWORD is required when the platform login page is shown');
    }
    const inputs = page.locator('input:not([type="hidden"])');
    await inputs.nth(0).fill(USERNAME);
    await inputs.nth(1).fill(PASSWORD);
    await page.getByRole('button', { name: /登录|Login/i }).click();
    await page.waitForTimeout(2500);
  }
  await page.goto(`${APP_URL}/automation/web/cases?workspace=${WORKSPACE_CODE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  if (await page.locator('input[type="password"]').count()) {
    throw new Error('login did not leave the login page');
  }
}

async function startPolling(installId) {
  await runnerRequest('/tasks/poll/start', {
    apiBaseUrl: API_BASE_URL,
    installId,
    capabilities: ['WEB_CASE_RUN', 'WEB_ELEMENT_VALIDATE'],
    workspaceCodes: [WORKSPACE_CODE],
    intervalMs: 1000,
  });
}

async function resetRunnerState() {
  await runnerRequest('/tasks/poll/stop', {}).catch(() => null);
  await runnerRequest('/session/release', {}).catch(() => null);
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
  }, { apiBaseUrl: API_BASE_URL, path, workspaceCode: WORKSPACE_CODE, options });
}

async function runnerRequest(path, body, method = 'POST') {
  const response = await fetch(`${RUNNER_BASE_URL}${path}`, {
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

main();
