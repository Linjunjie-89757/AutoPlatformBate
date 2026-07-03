import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const loginUrl = 'https://portal-test.integrity.com.cn/admin/login?v=1';
const account = '19966468884';
const password = 'Shitao123@';
const outDir = 'output/automation/order-center';

await fs.mkdir(outDir, { recursive: true });

async function login(page) {
  await page.locator('input').nth(0).fill(account);
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(password);

  const submit = page.getByRole('button', { name: /登录|登 录|Login/i }).first();
  if (await submit.count()) {
    await submit.click();
  } else {
    await passwordInput.press('Enter');
  }

  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function ensureLoggedIn(page, returnUrl) {
  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  const needsRelogin = /重新登录|登录状态.*过期|登录已过期|请重新登录/.test(bodyText);
  if (needsRelogin) {
    const relogin = page.getByText(/重新登录|重新登陆|去登录|确定/).last();
    if (await relogin.count()) {
      await relogin.click();
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  const hasLoginForm = await page.locator('input[type="password"]').first().isVisible({ timeout: 3000 }).catch(() => false);
  if (hasLoginForm) {
    await login(page);
    if (returnUrl && !page.url().includes('/traffic/')) {
      await page.goto(returnUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }
}

const browser = await chromium.launch({ headless: false, slowMo: 80 });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();
const requests = [];

page.on('requestfinished', async (request) => {
  const response = await request.response().catch(() => null);
  const url = request.url();
  if (!response || !/integrity\.com\.cn/.test(url)) return;
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|map)(\?|$)/i.test(url)) return;
  requests.push({
    method: request.method(),
    url,
    status: response.status(),
    postData: request.postData(),
    resourceType: request.resourceType(),
  });
});

await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.screenshot({ path: `${outDir}/01-login.png`, fullPage: true });

const inputs = await page.locator('input').evaluateAll(nodes => nodes.map((node, index) => ({
  index,
  type: node.getAttribute('type'),
  placeholder: node.getAttribute('placeholder'),
  name: node.getAttribute('name'),
  id: node.id,
  autocomplete: node.getAttribute('autocomplete'),
})));
console.log('inputs', inputs);

await login(page);
await page.screenshot({ path: `${outDir}/02-after-login.png`, fullPage: true });
console.log('after login url', page.url());
console.log('title', await page.title());

const textSnapshot = await page.locator('body').innerText({ timeout: 10000 }).catch(error => `BODY_ERROR:${error.message}`);
await fs.writeFile(`${outDir}/body-after-login.txt`, textSnapshot, 'utf8');

const orderEntry = page.getByText('订单中心', { exact: false }).first();
if (await orderEntry.count()) {
  await orderEntry.click();
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await ensureLoggedIn(page, page.url());
}
await page.screenshot({ path: `${outDir}/03-order-center.png`, fullPage: true });

const bodyText = await page.locator('body').innerText().catch(() => '');
await fs.writeFile(`${outDir}/body-order-center.txt`, bodyText, 'utf8');

const menuCandidates = await page.locator('a, li, [role="menuitem"], .el-menu-item, .ant-menu-item, .menu-item').evaluateAll(nodes => {
  const seen = new Set();
  return nodes.map((node, index) => {
    const rect = node.getBoundingClientRect();
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    const key = `${text}|${Math.round(rect.left)}|${Math.round(rect.top)}`;
    if (!text || seen.has(key)) return null;
    seen.add(key);
    return {
      index,
      text,
      tag: node.tagName,
      role: node.getAttribute('role'),
      className: node.getAttribute('class'),
      href: node.getAttribute('href'),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  }).filter(Boolean);
});
await fs.writeFile(`${outDir}/menu-candidates.json`, JSON.stringify(menuCandidates, null, 2), 'utf8');
await fs.writeFile(`${outDir}/requests.json`, JSON.stringify(requests, null, 2), 'utf8');
console.log('menu candidates', menuCandidates.length);
console.log(menuCandidates.slice(0, 80));

await context.storageState({ path: `${outDir}/storage-state.json` });
await browser.close();
