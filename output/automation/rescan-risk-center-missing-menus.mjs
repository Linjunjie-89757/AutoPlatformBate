import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const outDir = 'output/automation/risk-center';
const loginUrl = 'https://portal-test.integrity.com.cn/admin/login?v=1';
const startUrl = 'http://traffic-test.integrity.com.cn/traffic/dashboard';
const account = '19966468884';
const password = 'Shitao123@';
const menus = ['订单质检', '订单统计', '电话质检', '质检规则', '会话质检', '素材质检'];

async function login(page) {
  await page.locator('input').nth(0).fill(account);
  await page.locator('input[type="password"]').first().fill(password);
  const loginButton = page.getByRole('button', { name: /登录|登 录|Login/i }).first();
  if (await loginButton.count()) await loginButton.click();
  else await page.locator('input[type="password"]').first().press('Enter');
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function ensureLoggedIn(page, returnUrl) {
  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  const needsRelogin = /重新登录|登录状态.*过期|登录已过期|请重新登录/.test(bodyText);
  if (needsRelogin) {
    const relogin = page.getByText(/重新登录|重新登陆|去登录|确定/).last();
    if (await relogin.count()) await relogin.click();
    await page.waitForTimeout(1000);
  }
  const hasLoginForm = await page.locator('input[type="password"]').first().isVisible({ timeout: 3000 }).catch(() => false);
  if (hasLoginForm) {
    await login(page);
    if (returnUrl && !page.url().includes('/traffic/')) {
      await page.goto(returnUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);
    }
  }
}

function isBusinessRequest(url) {
  if (/clklog-test|passport\.feishu|\/admin\/login|unionlogin/.test(url)) return false;
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|map)(\?|$)/i.test(url)) return false;
  return /integrity\.com\.cn/.test(url);
}

function safeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
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
      .filter((item) =>
        item.text === targetText &&
        item.rect.width > 0 &&
        item.rect.height > 0 &&
        item.rect.left < 230 &&
        item.rect.top > 60
      )
      .sort((a, b) => {
        const ax = a.rect.left + a.rect.width / 2;
        const bx = b.rect.left + b.rect.width / 2;
        return bx - ax || b.rect.top - a.rect.top;
      });
    const target = candidates[0]?.node;
    if (!target) {
      return { clicked: false, candidates: candidates.map((item) => ({ text: item.text, rect: item.rect.toJSON?.() || item.rect })) };
    }
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return { clicked: true, count: candidates.length };
  }, menu);
}

async function scanMenu(page, menu) {
  const requests = [];
  const start = Date.now();
  const onRequestFinished = async (request) => {
    const response = await request.response().catch(() => null);
    const url = request.url();
    if (!response || !isBusinessRequest(url)) return;
    requests.push({
      method: request.method(),
      url,
      status: response.status(),
      postData: request.postData(),
      resourceType: request.resourceType(),
      elapsedMs: Date.now() - start,
    });
  };
  page.on('requestfinished', onRequestFinished);
  try {
    const clickResult = await clickLeftLeaf(page, menu);
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await ensureLoggedIn(page, page.url());
    const name = safeName(menu);
    await page.screenshot({ path: `${outDir}/rescan-menu-${name}.png`, fullPage: true });
    const bodyText = await page.locator('body').innerText().catch(() => '');
    await fs.writeFile(`${outDir}/rescan-menu-${name}.txt`, bodyText, 'utf8');
    return { menu, ok: clickResult.clicked, clickResult, url: page.url(), requests };
  } finally {
    page.off('requestfinished', onRequestFinished);
  }
}

const browser = await chromium.launch({ headless: false, slowMo: 60 });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();

await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await login(page);
await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await ensureLoggedIn(page, startUrl);
await page.getByText('风控中心', { exact: false }).first().click();
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3000);

const results = [];
for (const menu of menus) {
  console.log(`rescan ${menu}`);
  const result = await scanMenu(page, menu).catch((error) => ({ menu, ok: false, error: error.message, requests: [] }));
  console.log(`${menu}: ${result.requests?.length || 0}`);
  results.push(result);
}

await fs.writeFile(`${outDir}/menu-rescan-missing-results.json`, JSON.stringify(results, null, 2), 'utf8');
await browser.close();
