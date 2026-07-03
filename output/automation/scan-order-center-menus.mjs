import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const outDir = 'output/automation/order-center';
const loginUrl = 'https://portal-test.integrity.com.cn/admin/login?v=1';
const startUrl = 'http://traffic-test.integrity.com.cn/traffic/dashboard';
const account = '19966468884';
const password = 'Shitao123@';
const menus = [
  '风控设置',
  '退款协议',
  '商品分类',
  '商品规格',
  '商品权益',
  '优惠券管理',
  '商品活动',
  '优惠券记录',
  '销售合同',
  '付款审核',
  '退款审批',
  '财务对账',
  '发票记录',
  '资金明细',
];

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
  return /(?:japi-test|capi-test|traffic-test|traffic-admin|system-management|system-admin)/.test(url);
}

function safeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
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

  const locator = page.locator('a').filter({ hasText: menu }).first();
  if (!(await locator.count())) {
    page.off('requestfinished', onRequestFinished);
    return { menu, ok: false, error: '菜单未找到', requests: [] };
  }
  try {
    await locator.click({ timeout: 5000 });
  } catch {
    const clicked = await page.evaluate((targetText) => {
      const nodes = Array.from(document.querySelectorAll('a'));
      const target = nodes.find(node => (node.textContent || '').replace(/\s+/g, '').includes(targetText));
      if (!target) return false;
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    }, menu.replace(/\s+/g, ''));
    if (!clicked) {
      throw new Error('菜单点击失败');
    }
  }
  await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1800);
  await ensureLoggedIn(page, page.url());

  const name = safeName(menu);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const buttons = await page.locator('button, [role="button"], a').evaluateAll(nodes => {
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
  page.off('requestfinished', onRequestFinished);
  return { menu, ok: true, url: page.url(), requests, buttons };
}

const browser = await chromium.launch({ headless: false, slowMo: 50 });
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
await page.screenshot({ path: `${outDir}/scan-start-before-order.png`, fullPage: true });
await page.locator('text=订单中心').first().click().catch(() => {});
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3500);
await ensureLoggedIn(page, startUrl);
await page.screenshot({ path: `${outDir}/scan-start-after-order.png`, fullPage: true });
const startupLinks = await page.locator('a').evaluateAll(nodes => nodes.map(node => (node.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)).catch(error => [`ERROR:${error.message}`]);
await fs.writeFile(`${outDir}/scan-start-links.json`, JSON.stringify(startupLinks, null, 2), 'utf8');

const results = [];
for (const menu of menus) {
  console.log(`scan ${menu}`);
  const result = await collectMenu(page, menu).catch(error => ({
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
await browser.close();
