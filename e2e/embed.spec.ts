/**
 * Local embed shell — no remote relay required.
 * Uses the same dev server as other e2e (`npm run dev` → dist + public copy).
 *
 * Run: npx playwright test e2e/embed.spec.ts
 * Or: PW_NO_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npx playwright test e2e/embed.spec.ts
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test.describe.configure({ mode: 'serial' })

test.describe('Embed bundle (local)', () => {
  test('embed.js and embed.css are served from /assets', async ({ request }) => {
    const js = await request.get('/assets/embed.js')
    const css = await request.get('/assets/embed.css')
    expect(js.ok(), await js.text()).toBeTruthy()
    expect(css.ok(), await css.text()).toBeTruthy()
    expect((await js.text()).length).toBeGreaterThan(10)
    expect((await css.text()).length).toBeGreaterThan(50)
  })

  test('embed.js graph has no React', async () => {
    const { spawnSync } = await import('node:child_process')
    const r = spawnSync(process.execPath, ['scripts/assert-embed-no-react.mjs'], {
      cwd: clientRoot,
      encoding: 'utf8',
    })
    expect(r.status, r.stdout + r.stderr).toBe(0)
  })

  test('embed.html WASM-mounts client hook (no React shell / Home chrome)', async ({ page }) => {
    const reactAssetReqs: string[] = []
    page.on('request', (req) => {
      const u = req.url()
      if (/\/assets\//.test(u) && /react/i.test(u)) reactAssetReqs.push(u)
    })

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

    const root = page.locator('#root')
    await expect(root).toHaveAttribute('data-relay-embed', '1', { timeout: 60_000 })
    // CSR mount should populate the root (hook UI or error panel — not an empty React shell).
    await expect
      .poll(async () => root.evaluate((el) => el.childElementCount), { timeout: 60_000 })
      .toBeGreaterThan(0)

    await expect(page.getByTestId('relay-embed-app')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Relay' })).toHaveCount(0)
    await expect(page.locator('span[title="Test"]')).toHaveCount(0)

    expect(
      reactAssetReqs.filter((u) => /react\.(development|production)|react-dom/i.test(u)),
    ).toEqual([])
  })
})
