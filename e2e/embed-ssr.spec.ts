/**
 * Local SSR hydration — fixture HTML + embed.js + WASM.
 *
 * Run: npx playwright test e2e/embed-ssr.spec.ts
 */
import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Embed SSR hydration (local)', () => {
  test('embed assets and WASM are served', async ({ request }) => {
    const js = await request.get('/assets/embed.js')
    const css = await request.get('/assets/embed.css')
    const wasm = await request.get('/wasm/relay_runtime_pkg/relay_runtime_bg.wasm')
    expect(js.ok(), await js.text()).toBeTruthy()
    expect(css.ok(), await css.text()).toBeTruthy()
    expect(wasm.ok()).toBeTruthy()
    const ct = wasm.headers()['content-type'] || ''
    expect(ct.includes('wasm') || ct.includes('octet-stream') || ct.length === 0).toBeTruthy()
    expect((await wasm.body()).byteLength).toBeGreaterThan(1000)
    const jsText = await js.text()
    expect(jsText).not.toMatch(/react\.development|from ["']react["']|createRoot\s*\(/)
  })

  test('hydrates then enables theme toggle via setCurrentTheme', async ({ page }) => {
    await page.goto('/embed-ssr.html')
    const root = page.locator('#root')
    await expect(page.locator('#ssr-static-line')).toHaveText('Static content for no-JS browsers')

    // After hydrate + live promote, theme toggle works via setCurrentTheme / html.dark
    const themeBtn = page.locator('#ssr-theme-toggle')
    await expect(themeBtn).toBeEnabled({ timeout: 60_000 })
    await expect
      .poll(async () => root.getAttribute('data-relay-hydrated'), { timeout: 60_000 })
      .toBe('1')

    await themeBtn.click()
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.classList.contains('dark')), {
        timeout: 15_000,
      })
      .toBe(true)
    await expect(themeBtn).toContainText(/Theme:\s*dark/i)

    await page.locator('#ssr-increment').click()
    await expect(page.locator('#ssr-count')).toContainText('1')
    await expect(page.locator('#ssr-hydrate-demo')).toBeVisible()
  })

  test('no-JS shows SSR content with theme toggle disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/embed-ssr.html')
    await expect(page.locator('#ssr-static-line')).toHaveText('Static content for no-JS browsers')
    await expect(page.getByRole('heading', { name: 'SSR Hydrate Demo' })).toBeVisible()
    await expect(page.locator('#ssr-theme-toggle')).toBeDisabled()
    await expect(page.locator('#root')).toHaveAttribute('data-relay-ssr', '1')
    await context.close()
  })

  test('hydration failure keeps SSR content and shows error panel', async ({ page }) => {
    await page.goto('/embed-ssr-error.html')
    const root = page.locator('#root')
    await expect(root).toHaveAttribute('data-relay-ssr', '1')
    // Error panel appears with diagnostics…
    const panel = page.locator('.relay-hook-error')
    await expect(panel).toBeVisible({ timeout: 60_000 })
    await expect(panel).toContainText(/error/i)
    // …but the SSR page is NOT wiped.
    await expect(page.locator('#ssr-static-line')).toHaveText('Static content for no-JS browsers')
    await expect(page.locator('#ssr-hydrate-demo')).toBeVisible()
  })
})
