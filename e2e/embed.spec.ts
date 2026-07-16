/**
 * Local embed shell — no remote relay required.
 * Uses the same dev server as other e2e (`npm run dev` → dist + public copy).
 *
 * Run: npx playwright test e2e/embed.spec.ts
 * Or: PW_NO_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npx playwright test e2e/embed.spec.ts
 */
import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Embed bundle (local)', () => {
  test('embed.js and embed.css are served from /assets', async ({ request }) => {
    const js = await request.get('/assets/embed.js')
    const css = await request.get('/assets/embed.css')
    expect(js.ok(), await js.text()).toBeTruthy()
    expect(css.ok(), await css.text()).toBeTruthy()
    expect((await js.text()).length).toBeGreaterThan(10)
    expect((await css.text()).length).toBeGreaterThan(100)
  })

  test('embed.html bootstraps relay-embed-app and hook shell (no full Home chrome)', async ({ page }) => {
    await page.goto('/embed.html')
    await page.evaluate(() => {
      try {
        localStorage.clear()
      } catch {
        /* ignore */
      }
    })
    await page.goto('/embed.html')

    const cfgText = await page.locator('#relay-embed-config').evaluate((el) => el.textContent ?? '')
    expect(cfgText).toContain('demo')

    await expect(page.getByTestId('relay-embed-app')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('relay-hook-shell')).toBeVisible({ timeout: 30_000 })

    await expect(page.getByRole('heading', { name: 'Relay' })).toHaveCount(0)
    await expect(page.locator('span[title="Test"]')).toHaveCount(0)
  })
})
