import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const outDir = 'output/automation/customer-center-crud';
const saved = JSON.parse(await fs.readFile(`${outDir}/department-save-result.json`, 'utf8'));
const departmentName = saved.departmentName;
const departmentNameEdit = `${departmentName}_E`;
const departmentDescEdit = `自动化CRUD编辑 ${departmentName}`;
const loginUrl = 'https://portal-test.integrity.com.cn/admin/login?v=1';
const startUrl = 'http://traffic-test.integrity.com.cn/traffic/dashboard';
const account = '19966468884';
const password = 'Shitao123@';

async function login(page) {
  await page.locator('input').nth(0).fill(account);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /登录|登 录|Login/i }).first().click();
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function clickText(page, text) {
  const locator = page.getByText(text, { exact: false }).first();
  if (await locator.count()) {
    await locator.click({ timeout: 6000 });
    return true;
  }
  return false;
}

async function clickLeftLeaf(page, menu) {
  return page.evaluate((targetText) => {
    const nodes = Array.from(document.querySelectorAll('a, li, span, div, [role="menuitem"], .el-menu-item'));
    const candidates = nodes
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        return { node, rect, text };
      })
      .filter((item) => item.text === targetText && item.rect.width > 0 && item.rect.height > 0 && item.rect.left < 260 && item.rect.top > 60)
      .sort((a, b) => (b.rect.left + b.rect.width / 2) - (a.rect.left + a.rect.width / 2) || b.rect.top - a.rect.top);
    const target = candidates[0]?.node;
    if (!target) return false;
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, menu);
}

function isBusinessRequest(url) {
  if (/clklog-test|passport\.feishu|\/admin\/login|unionlogin/.test(url)) return false;
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|map)(\?|$)/i.test(url)) return false;
  return /integrity\.com\.cn/.test(url);
}

const browser = await chromium.launch({ headless: false, slowMo: 80 });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await context.newPage();
const requests = [];

page.on('requestfinished', async (request) => {
  const response = await request.response().catch(() => null);
  const url = request.url();
  if (!response || !isBusinessRequest(url)) return;
  let responseBody = null;
  const contentType = response.headers()['content-type'] || '';
  if (contentType.includes('application/json')) responseBody = await response.text().catch(() => null);
  requests.push({ method: request.method(), url, status: response.status(), postData: request.postData(), responseBody });
});

await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await login(page);
await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await clickText(page, '获客中心');
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);
await clickLeftLeaf(page, '部门分类');
await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(1200);

const row = page.locator('.el-table__body-wrapper tr').filter({ hasText: departmentName }).first();
await row.getByRole('button', { name: /^编辑$/ }).click();
await page.waitForTimeout(800);
await page.locator('input[placeholder="请输入部门名称"]').fill(departmentNameEdit);
await page.locator('textarea[placeholder="请输入来源描述"]').fill(departmentDescEdit);
await page.getByRole('button', { name: /^确认$/ }).last().click();
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1200);

const editedRow = page.locator('.el-table__body-wrapper tr').filter({ hasText: departmentNameEdit }).first();
await editedRow.getByRole('button', { name: /^删除$/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /^确定$/ }).last().click();
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/department-after-delete.png`, fullPage: true });

await fs.writeFile(`${outDir}/department-edit-delete-result.json`, JSON.stringify({ departmentName, departmentNameEdit, requests }, null, 2), 'utf8');
console.log(JSON.stringify({ departmentName, departmentNameEdit, requestCount: requests.length }, null, 2));
await browser.close();
