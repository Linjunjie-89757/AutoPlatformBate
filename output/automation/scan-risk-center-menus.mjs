import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const outDir = 'output/automation/risk-center';
const loginUrl = 'https://portal-test.integrity.com.cn/admin/login?v=1';
const startUrl = 'http://traffic-test.integrity.com.cn/traffic/dashboard';
const account = '19966468884';
const password = 'Shitao123@';

await fs.mkdir(outDir, { recursive: true });

async function login(page) {
  await page.locator('input').nth(0).fill(account);
  await page.locator('input[type="password"]').first().fill(password);
  const loginButton = page.getByRole('button', { name: /登录|登 录|Login/i }).first();
  if (await loginButton.count()) {
    await loginButton.click();
  } else {
    await page.locator('input[type="password"]').first().press('Enter');
  }
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
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

function isBusinessRequest(url) {
  if (/clklog-test|passport\.feishu|\/admin\/login|unionlogin/.test(url)) return false;
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|map)(\?|$)/i.test(url)) return false;
  return /(?:japi-test|capi-test|traffic-test|risk|questionnaire|system-management|system-admin|order-admin)/.test(url);
}

function safeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

async function clickText(page, text) {
  const locator = page.getByText(text, { exact: false }).first();
  if (await locator.count()) {
    await locator.click({ timeout: 6000 });
    return true;
  }
  return page.evaluate((targetText) => {
    const normalizedTarget = targetText.replace(/\s+/g, '');
    const nodes = Array.from(document.querySelectorAll('a, li, button, [role="menuitem"], .el-menu-item'));
    const target = nodes.find((node) => (node.textContent || '').replace(/\s+/g, '').includes(normalizedTarget));
    if (!target) return false;
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, text);
}

async function collectMenuCandidates(page) {
  const candidates = await page.locator('a, li, [role="menuitem"], .el-menu-item, .ant-menu-item, .menu-item').evaluateAll((nodes) => {
    const seen = new Set();
    return nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      const key = `${text}|${Math.round(rect.left)}|${Math.round(rect.top)}`;
      if (!text || seen.has(key) || rect.width === 0 || rect.height === 0) return null;
      seen.add(key);
      return {
        text,
        tag: node.tagName,
        role: node.getAttribute('role'),
        className: node.getAttribute('class'),
        href: node.getAttribute('href'),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    }).filter(Boolean);
  });

  const ignore = new Set(['首页', '工作台', '订单中心', '风控中心', '获客中心', '系统管理']);
  return candidates
    .filter((item) => item.rect.x < 360 && item.rect.y > 70)
    .map((item) => item.text)
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .filter((text) => text.length <= 30 && !ignore.has(text))
    .filter((text, index, arr) => arr.indexOf(text) === index);
}

async function collectMenu(page, menu) {
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
    const clicked = await clickText(page, menu);
    if (!clicked) return { menu, ok: false, error: '菜单未找到', requests: [], buttons: [] };
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1800);
    await ensureLoggedIn(page, page.url());
    const name = safeName(menu);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const buttons = await page.locator('button, [role="button"], a').evaluateAll((nodes) => {
      const seen = new Set();
      return nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        const disabled = node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true';
        const key = `${text}|${Math.round(rect.x)}|${Math.round(rect.y)}`;
        if (!text || seen.has(key) || rect.width === 0 || rect.height === 0) return null;
        seen.add(key);
        return {
          text,
          tag: node.tagName,
          className: node.getAttribute('class'),
          disabled,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        };
      }).filter(Boolean);
    });
    await page.screenshot({ path: `${outDir}/menu-${name}.png`, fullPage: true });
    await fs.writeFile(`${outDir}/menu-${name}.txt`, bodyText, 'utf8');
    await fs.writeFile(`${outDir}/menu-${name}-buttons.json`, JSON.stringify(buttons, null, 2), 'utf8');
    return { menu, ok: true, url: page.url(), requests, buttons };
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
await page.screenshot({ path: `${outDir}/scan-start.png`, fullPage: true });

await clickText(page, '风控中心');
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3500);
await ensureLoggedIn(page, startUrl);
await page.screenshot({ path: `${outDir}/scan-risk-center-home.png`, fullPage: true });

const bodyText = await page.locator('body').innerText().catch(() => '');
const menus = await collectMenuCandidates(page);
await fs.writeFile(`${outDir}/risk-center-home.txt`, bodyText, 'utf8');
await fs.writeFile(`${outDir}/menu-candidates.json`, JSON.stringify(menus, null, 2), 'utf8');
console.log('menus', menus);

const results = [];
for (const menu of menus) {
  console.log(`scan ${menu}`);
  const result = await collectMenu(page, menu).catch((error) => ({
    menu,
    ok: false,
    error: error.message,
    requests: [],
    buttons: [],
  }));
  console.log(`${menu}: ${result.requests?.length || 0} requests`);
  results.push(result);
}

await fs.writeFile(`${outDir}/menu-scan-results.json`, JSON.stringify(results, null, 2), 'utf8');
await context.storageState({ path: `${outDir}/storage-state.json` });
await browser.close();
