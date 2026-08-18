/**
 * Validates relay-client-web against real relay masters (default: dfw1).
 *
 * Env:
 *   E2E_RELAY_HOST   — substring to match a node card (default: dfw1.relaygateway.net)
 *   E2E_RELAY_REPO   — repo name to open (default: paradigm-threat-files)
 *   PW_NO_SERVER=1   — do not spawn `npm run dev`; use existing server at PLAYWRIGHT_BASE_URL
 *
 * Run: npm run test:e2e
 */
import { test, expect } from '@playwright/test'

const RELAY_SUBSTR = process.env.E2E_RELAY_HOST ?? 'dfw1.relaygateway.net'
const RELAY_REPO = process.env.E2E_RELAY_REPO ?? 'paradigm-threat-files'

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

  test('home: Relay shell, live node, and repo list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Relay' })).toBeVisible()
    const nodeCard = page.getByTestId('node-card').filter({ hasText: RELAY_SUBSTR }).first()
    await expect(nodeCard).toBeVisible({ timeout: 15_000 })
    await expect(nodeCard.getByText(RELAY_REPO, { exact: false }).first()).toBeVisible({
      timeout: 100_000,
    })
  })

  test('open repo tab (not node apex), hook shell visible', async ({ page }) => {
    const nodeCard = page.getByTestId('node-card').filter({ hasText: RELAY_SUBSTR }).first()
    await expect(nodeCard).toBeVisible({ timeout: 15_000 })

    await expect(nodeCard.getByText(/Online|Incomplete|Offline/).first()).toBeVisible({ timeout: 100_000 })

    if (await nodeCard.getByText(/^Offline$/).first().isVisible().catch(() => false)) {
      test.skip(
        true,
        `Node matching "${RELAY_SUBSTR}" is Offline — check network or set E2E_RELAY_HOST`,
      )
    }

    const openBtn = nodeCard.locator(`[data-testid="open-repo"][data-repo="${RELAY_REPO}"]`).first()
    const fallbackOpen = nodeCard.getByTestId('open-repo').first()
    const btn = (await openBtn.count()) > 0 ? openBtn : fallbackOpen
    await btn.click()

    await expect(page.getByTestId('relay-hook-shell')).toBeVisible({ timeout: 60_000 })
    const hookFrame = page.frameLocator('[data-testid="relay-hook-shell"] iframe')
    await expect(hookFrame.locator('.relay-boot-shell, .pt-shell').first()).toBeVisible({
      timeout: 120_000,
    })
    await expect(hookFrame.locator('.pt-shell').first()).toBeVisible({ timeout: 120_000 })
    await expect(page.getByText('Hook error', { exact: false })).toHaveCount(0)
    await expect(page.getByText(/Module not found/)).toHaveCount(0)
    await expect(hookFrame.getByText(/Module not found/)).toHaveCount(0)
    await expect(page.getByText('Hook shell (stub)')).toHaveCount(0)

    await expect(page.locator('span[title]').filter({ hasText: RELAY_REPO }).first()).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.locator('span[title]').filter({ hasText: new RegExp(`^https://${RELAY_SUBSTR}/?$`) })).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`[?&]repo=${RELAY_REPO}`))

    await page.getByTestId('tab-fullscreen').click()
    await expect(page.getByTestId('shell-chrome')).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`[?&]view=${RELAY_REPO}`))
    await expect(page.getByTestId('relay-hook-shell')).toBeVisible()

    await page.goBack()
    await expect(page.getByTestId('shell-chrome')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`[?&]repo=${RELAY_REPO}`))
  })

  test('unsupported pasted URL shows Not supported', async ({ page }) => {
    await page.getByPlaceholder(/client hook/i).fill('https://example.com')
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page.getByRole('heading', { name: 'Not supported' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('relay-hook-shell')).toHaveCount(0)
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
