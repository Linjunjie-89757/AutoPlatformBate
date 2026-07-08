import { chromium } from 'playwright';

const appUrl = 'http://localhost:4173';
const apiBaseUrl = 'http://localhost:8080/api';
const workspaceCode = 'account-open';
const targetCaseName = process.env.TARGET_CASE_NAME || 'Web UI Upload Smoke';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  if (await page.locator('input[type="password"]').count()) {
    const inputs = page.locator('input:not([type="hidden"])');
    await inputs.nth(0).fill('zhangli');
    await inputs.nth(1).fill('123456');
    await page.getByRole('button', { name: /登录|Login/i }).click();
    await page.waitForTimeout(2000);
  }
  const cases = await api(page, '/automation/web/cases?page=1&size=50');
  const items = cases.data?.records || cases.data?.items || [];
  const target = items.find(item => String(item.name || item.caseName || '').includes(targetCaseName));
  if (!target) throw new Error(`case not found: ${targetCaseName}`);
  const caseId = Number(target.id || target.caseId);
  const detail = await api(page, `/automation/web/cases/${caseId}`);
  console.log(JSON.stringify({
    id: caseId,
    name: target.name || target.caseName,
    steps: (detail.data?.steps || []).map(step => ({
      id: step.id,
      stepName: step.stepName || step.name,
      stepType: step.stepType || step.type,
      inputValue: step.inputValue,
      uploadArtifactBinding: step.uploadArtifactBinding || null,
    })),
  }, null, 2));
} finally {
  await browser.close();
}

async function api(page, path) {
  return page.evaluate(async ({ apiBaseUrl, path, workspaceCode }) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Code': workspaceCode,
      },
    });
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      throw new Error(`API ${path} failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return payload;
  }, { apiBaseUrl, path, workspaceCode });
}
