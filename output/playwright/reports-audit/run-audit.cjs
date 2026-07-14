const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

async function main() {
  const outDir = path.resolve('output/playwright/reports-audit')
  fs.mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    viewport: { width: 1920, height: 862 },
    deviceScaleFactor: 1,
  })

  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: { id: 1, username: 'demo', displayName: '张程远', email: 'demo@example.com' },
    }),
  }))

  await page.goto('http://127.0.0.1:5173/reports', { waitUntil: 'networkidle' })
  await page.waitForSelector('.report-center-page')
  await page.screenshot({ path: path.join(outDir, '01-list.png'), fullPage: false })

  await page.locator('.report-row-actions button').first().click()
  await page.waitForSelector('.report-detail-body')
  await page.screenshot({ path: path.join(outDir, '02-detail-empty.png'), fullPage: false })

  const result = {}
  result.empty = await page.evaluate(() => {
    const el = document.querySelector('.report-step-canvas-empty')
    const b = el?.getBoundingClientRect()
    return {
      text: el?.textContent?.replace(/\s+/g, ' ').trim(),
      rect: b && { x: b.x, y: b.y, w: b.width, h: b.height },
    }
  })

  await page.locator('.report-step-item').first().click()
  await page.screenshot({ path: path.join(outDir, '03-success-selected.png'), fullPage: false })
  result.successSelected = await page.evaluate(() => {
    const card = document.querySelector('.report-step-detail-card')
    const sections = [...document.querySelectorAll('.report-section-card,.report-step-pass-card')].map((el) => {
      const b = el.getBoundingClientRect()
      return {
        cls: el.className,
        text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 100),
        rect: { x: b.x, y: b.y, w: b.width, h: b.height },
      }
    })
    const b = card?.getBoundingClientRect()
    return { card: b && { x: b.x, y: b.y, w: b.width, h: b.height }, sections }
  })

  await page.locator('.report-expand-button').click()
  await page.waitForSelector('.report-step-drawer')
  const tabs = ['request', 'response', 'assertion', 'log', 'ai']
  result.successDrawer = {}
  for (const tab of tabs) {
    const index = { request: 0, response: 1, assertion: 2, log: 3, ai: 4 }[tab]
    await page.locator('.report-step-drawer__tabs button').nth(index).click()
    await page.waitForTimeout(80)
    await page.screenshot({ path: path.join(outDir, `04-success-${tab}.png`), fullPage: false })
    result.successDrawer[tab] = await page.evaluate(() => {
      const drawer = document.querySelector('.report-step-drawer')
      const active = document.querySelector('.report-step-drawer__tabs .is-active')
      const content = document.querySelector('.report-step-drawer__content')
      const code = document.querySelector('.report-step-drawer__content .report-code-block')
      const b = drawer.getBoundingClientRect()
      const cb = content.getBoundingClientRect()
      const kb = code?.getBoundingClientRect()
      return {
        active: active?.textContent.trim(),
        drawer: { x: b.x, y: b.y, w: b.width, h: b.height },
        content: { x: cb.x, y: cb.y, w: cb.width, h: cb.height },
        code: kb && { x: kb.x, y: kb.y, w: kb.width, h: kb.height },
        text: content.textContent.replace(/\s+/g, ' ').trim().slice(0, 220),
      }
    })
  }
  await page.locator('.report-step-drawer__header button').click()

  await page.locator('.report-step-item').nth(3).click()
  await page.screenshot({ path: path.join(outDir, '05-failed-selected.png'), fullPage: false })
  result.failedSelected = await page.evaluate(() => [...document.querySelectorAll('.report-section-card,.report-step-pass-card')].map((el) => {
    const b = el.getBoundingClientRect()
    return {
      cls: el.className,
      text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 140),
      rect: { x: b.x, y: b.y, w: b.width, h: b.height },
    }
  }))

  await page.locator('.report-step-item').nth(4).click()
  await page.screenshot({ path: path.join(outDir, '06-skipped-selected.png'), fullPage: false })
  await page.locator('.report-expand-button').click()
  await page.waitForSelector('.report-step-drawer')
  const skippedTabs = ['request', 'assertion', 'log', 'ai']
  result.skippedDrawer = {}
  for (const [i, tab] of skippedTabs.entries()) {
    await page.locator('.report-step-drawer__tabs button').nth(i).click()
    await page.waitForTimeout(80)
    await page.screenshot({ path: path.join(outDir, `07-skipped-${tab}.png`), fullPage: false })
    result.skippedDrawer[tab] = await page.evaluate(() => {
      const active = document.querySelector('.report-step-drawer__tabs .is-active')
      const content = document.querySelector('.report-step-drawer__content')
      return {
        active: active?.textContent.trim(),
        text: content.textContent.replace(/\s+/g, ' ').trim(),
        tabs: [...document.querySelectorAll('.report-step-drawer__tabs button')].map((button) => button.textContent.trim()),
      }
    })
  }

  fs.writeFileSync(path.join(outDir, 'measurements.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
