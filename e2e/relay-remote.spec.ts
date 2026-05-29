/**
 * Validates relay-client-web against real relay masters (default: relaynet nodes).
 * Requires network access from the machine running Playwright.
 *
 * Env:
 *   E2E_RELAY_HOST   — substring to match a peer card (default: atlanta2.relaygateway.net)
 *   PW_NO_SERVER=1   — do not spawn `npm run dev`; use existing server at PLAYWRIGHT_BASE_URL
 *
 * Run: npm run test:e2e
 */
import { test, expect } from '@playwright/test'

const RELAY_SUBSTR = process.env.E2E_RELAY_HOST ?? 'atlanta2.relaygateway.net'

test.describe.configure({ mode: 'serial' })

async function resetAppStorage (page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  })
  await page.goto('/')
}

test.describe('Relay client — remote masters', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppStorage(page)
  })

  test('home: Relay shell and configured peer row', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Relay' })).toBeVisible()
    await expect(page.getByText(RELAY_SUBSTR, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('remote peer: probe reaches Online, open tab, hook shell + host visible', async ({ page }) => {
    const peerCard = page.locator('div.cursor-pointer').filter({ hasText: RELAY_SUBSTR }).first()
    await expect(peerCard).toBeVisible({ timeout: 15_000 })

    await expect(peerCard.getByText(/Online|Offline/).first()).toBeVisible({ timeout: 100_000 })

    if (await peerCard.getByText(/^Offline$/).first().isVisible().catch(() => false)) {
      test.skip(
        true,
        `Peer matching "${RELAY_SUBSTR}" is Offline — check network or set E2E_RELAY_HOST`
      )
    }

    await expect(peerCard.getByText(/Online/).first()).toBeVisible()

    await peerCard.getByRole('button', { name: /Open →/ }).click()

    await expect(page.getByTestId('relay-hook-shell')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('Hook shell (stub)')).toHaveCount(0)
    await expect(page.getByTestId('relay-hook-shell').locator('.relay-hook-mount')).toBeVisible()

    await expect(page.getByText(RELAY_SUBSTR, { exact: false }).first()).toBeVisible()

    /** Path / repo tab title usually mirrors the host */
    await expect(page.locator('main').getByText(RELAY_SUBSTR, { exact: false })).toBeVisible({
      timeout: 30_000,
    })
  })
})

test.describe('Styles (Tailwind bundle)', () => {
  test('main.css loads and Tailwind utilities apply', async ({ page, request }) => {
    const css = await request.get('/assets/main.css')
    expect(css.ok()).toBeTruthy()
    const text = await css.text()
    expect(text.length).toBeGreaterThan(500)
    expect(text).toMatch(/\.flex\b|\.flex-col\b/)
    await page.goto('/')
    await expect(page.locator('.flex').first()).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Markdown / WASM (local smoke)', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppStorage(page)
  })

  test('Test tab shows md2ast / WASM AST output', async ({ page }) => {
    await page.locator('span[title="Test"]').click()

    await expect(page.getByText('markdown_to_ast_json').first()).toBeVisible({ timeout: 45_000 })
  })
})
