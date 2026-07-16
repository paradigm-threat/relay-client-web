/**
 * Playwright config for preset-remote-hook e2e only.
 * Injects RELAY_PUBLIC_PRESET_REMOTE_HOOK into the dev server (see e2e/preset-remote-hook.spec.ts).
 */
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'
const noServer = process.env.PW_NO_SERVER === '1'
const presetHookBase =
  process.env.E2E_PRESET_HOOK_BASE || process.env.RELAY_PUBLIC_PRESET_REMOTE_HOOK || 'http://127.0.0.1:3011'

export default defineConfig({
  testDir: './e2e',
  testMatch: /preset-remote-hook\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 150_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: noServer
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          RELAY_PUBLIC_PRESET_REMOTE_HOOK: presetHookBase,
        },
      },
})
