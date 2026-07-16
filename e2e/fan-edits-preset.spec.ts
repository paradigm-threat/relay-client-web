/**
 * fan-edits library UI via preset remote hook (relay-gateway + relay-runtime WASM).
 *
 * Requires:
 *   - fan-edits checkout at ~/dev/fan-edits (or FAN_EDITS_REPO)
 *   - relay-gateway built
 *
 * Run: npm run test:e2e:fan-edits
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const fanEditsRepo =
  process.env.FAN_EDITS_REPO || path.join(os.homedir(), 'dev', 'fan-edits')
const presetBase =
  process.env.E2E_PRESET_HOOK_BASE || process.env.RELAY_PUBLIC_PRESET_REMOTE_HOOK || 'http://127.0.0.1:3011'

const MANIFEST_ASSERT = ['Fan Edits', 'FanMixes', 'KidFriendly', 'Library home', 'Fried Green Tomatoes', 'Salvation']

test.describe('fan-edits preset hook', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(fanEditsRepo)) {
      test.skip(true, `fan-edits checkout missing: ${fanEditsRepo}`)
    }
  })

  test('library shell renders catalog strings from gateway', async ({ page }) => {
    const url = `/?relay_preset_hook=${encodeURIComponent(presetBase)}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 })

    await expect(page.getByTestId('relay-preset-remote-app')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('relay-hook-shell')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('.relay-hook-mount')).toBeVisible()

    for (const needle of MANIFEST_ASSERT) {
      await expect(page.getByText(needle, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
    }

    await expect(page.getByText(/projects in index\.json/i)).toBeVisible()
    await expect(page.getByText('Hook error', { exact: false })).toHaveCount(0)
    await expect(page.getByText('Render error', { exact: false })).toHaveCount(0)
  })
})
