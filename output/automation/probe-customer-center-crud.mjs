import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const outDir = 'output/automation/customer-center-crud';
const loginUrl = 'https://portal-test.integrity.com.cn/admin/login?v=1';
const startUrl = 'http://traffic-test.integrity.com.cn/traffic/dashboard';
const account = '19966468884';
const password = 'Shitao123@';

const menus = [
  '主播管理',
  '分配计划',
  '平台分类',
  '部门分类',
  '页面管理',
  '小程序管理',
  '回传配置',
  '广告主设置',
  '黑名单管理',
  '白名单管理',
];

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
  return /integrity\.com\.cn/.test(url);
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
        item.rect.left < 260 &&
        item.rect.top > 60
      )
      .sort((a, b) => {
        const ax = a.rect.left + a.rect.width / 2;
        const bx = b.rect.left + b.rect.width / 2;
        return bx - ax || b.rect.top - a.rect.top;
      });
    const target = candidates[0]?.node;
    if (!target) return false;
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, menu);
}

async function probeMenu(page, menu) {
  const requests = [];
  const onRequestFinished = async (request) => {
    const response = await request.response().catch(() => null);
    const url = request.url();
    if (!response || !isBusinessRequest(url)) return;
    let responseBody = null;
    const contentType = response.headers()['content-type'] || '';
    if (contentType.includes('application/json')) {
      responseBody = await response.text().catch(() => null);
    }
    requests.push({
      method: request.method(),
      url,
      status: response.status(),
      postData: request.postData(),
      resourceType: request.resourceType(),
      responseBody,
    });
  };
  page.on('requestfinished', onRequestFinished);

  try {
    const clicked = await clickLeftLeaf(page, menu);
    if (!clicked) return { menu, ok: false, error: '菜单未找到', requests: [], modalText: '' };
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await ensureLoggedIn(page, page.url());

    const edit = page.getByRole('button', { name: /^编辑$/ }).first();
    const create = page.getByRole('button', { name: /^(新建|新增)$/ }).first();
    let action = '';
    if (await create.isVisible({ timeout: 1500 }).catch(() => false)) {
      action = 'create';
      await create.click();
    } else if (await edit.isVisible({ timeout: 1500 }).catch(() => false)) {
      action = 'edit';
      await edit.click();
    } else {
      action = 'none';
    }
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const modalText = await page.locator('.el-dialog, .el-drawer, [role="dialog"]').last().innerText({ timeout: 3000 }).catch(() => '');
    const formFields = await page.locator('.el-dialog input, .el-dialog textarea, .el-dialog .el-select, .el-drawer input, .el-drawer textarea, .el-drawer .el-select').evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        tag: node.tagName,
        text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
        placeholder: node.getAttribute('placeholder'),
        value: node.value || node.getAttribute('value'),
        className: node.getAttribute('class'),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    })).catch(() => []);

    const name = safeName(menu);
    await page.screenshot({ path: `${outDir}/probe-${name}.png`, fullPage: true });
    return { menu, ok: true, action, url: page.url(), requests, modalText, formFields };
  } finally {
    page.off('requestfinished', onRequestFinished);
  }
}

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await context.newPage();

await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await login(page);
await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await ensureLoggedIn(page, startUrl);
await clickText(page, '获客中心');
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);

const results = [];
for (const menu of menus) {
  console.log(`probe ${menu}`);
  const result = await probeMenu(page, menu).catch((error) => ({ menu, ok: false, error: error.message, requests: [] }));
  results.push(result);
  console.log(`${menu}: ${result.action || 'error'} ${result.requests?.length || 0} requests`);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
}

await fs.writeFile(`${outDir}/probe-results.json`, JSON.stringify(results, null, 2), 'utf8');
await browser.close();
