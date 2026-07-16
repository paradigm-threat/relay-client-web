#!/usr/bin/env node
/**
 * Full-page screenshot of preset remote hook (styles sanity check).
 * Usage: node scripts/screenshot-preset.mjs [url] [out.png]
 */
import { chromium } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const url =
  process.argv[2] ||
  'http://127.0.0.1:5173/?relay_preset_hook=http://127.0.0.1:3010'
const out =
  process.argv[3] ||
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'screenshots', 'preset-remote.png')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
})
await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: out, fullPage: true })
await browser.close()
console.log('Wrote', out)
