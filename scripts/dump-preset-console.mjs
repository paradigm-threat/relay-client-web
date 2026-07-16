#!/usr/bin/env node
/**
 * Quick preset-console probe (errors/warnings only). Requires dev server + static files host.
 * Usage: node scripts/dump-preset-console.mjs [url]
 * Default: http://127.0.0.1:5173/?relay_preset_hook=http://127.0.0.1:3010
 */
import { chromium } from '@playwright/test'

const url =
  process.argv[2] ||
  'http://127.0.0.1:5173/?relay_preset_hook=http://127.0.0.1:3010'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const bad = []
page.on('console', (msg) => {
  const t = msg.type()
  if (t === 'error' || t === 'warning') {
    bad.push(`[${t}] ${msg.text()}`)
  }
})
page.on('pageerror', (e) => bad.push(`[pageerror] ${e.message}`))

await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 })
await page.waitForTimeout(2000)

const hookErr = await page.locator('text=/Hook error|Render error/i').count()
const paradigma = await page.getByText('Paradigm Threat').count()

console.log('URL:', url)
console.log('Paradigm headline visible:', paradigma > 0)
console.log('Hook/render error text on page:', hookErr > 0)
if (bad.length) {
  console.log('Console errors/warnings:')
  for (const line of bad) console.log(' ', line)
  process.exitCode = 1
} else {
  console.log('No console errors or warnings.')
}

await browser.close()
