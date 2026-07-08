import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const outputDir = 'output/playwright';
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const logs = [];
page.on('console', message => logs.push({ type: message.type(), text: message.text() }));
page.on('pageerror', error => logs.push({ type: 'pageerror', text: error.message }));

try {
  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${outputDir}/real-acceptance-initial.png`, fullPage: true });

  const inputs = await page.locator('input').evaluateAll(items => items.map((item, index) => ({
    index,
    type: item.getAttribute('type'),
    placeholder: item.getAttribute('placeholder'),
    name: item.getAttribute('name'),
    id: item.id,
  }))).catch(() => []);

  const loginLike = await page.locator('text=/登录|账号|密码|Login/i').count().catch(() => 0);
  if (loginLike > 0 || inputs.length >= 2) {
    const textInputs = page.locator('input:not([type="hidden"])');
    await textInputs.nth(0).fill('zhangli').catch(() => {});
    await textInputs.nth(1).fill('123456').catch(() => {});
    await page.getByRole('button', { name: /登录|Login/i }).click().catch(async () => {
      await page.locator('button').filter({ hasText: /登录|Login/i }).first().click();
    });
    await page.waitForTimeout(2500);
  }

  await page.goto('http://localhost:4173/automation/web/cases', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outputDir}/real-acceptance-web-cases.png`, fullPage: true });

  const summary = await page.evaluate(() => {
    const visibleText = document.body.innerText.slice(0, 6000);
    const buttons = Array.from(document.querySelectorAll('button')).map((item, index) => ({
      index,
      text: item.innerText.trim(),
      disabled: item.disabled,
      aria: item.getAttribute('aria-label'),
      title: item.getAttribute('title'),
    })).filter(item => item.text || item.aria || item.title).slice(0, 120);
    const links = Array.from(document.querySelectorAll('a')).map((item, index) => ({
      index,
      text: item.innerText.trim(),
      href: item.getAttribute('href'),
    })).filter(item => item.text || item.href).slice(0, 80);
    return { url: location.href, title: document.title, visibleText, buttons, links };
  });

  console.log(JSON.stringify({ success: true, inputs, summary, logs: logs.slice(-20) }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ success: false, error: error.message, logs }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
