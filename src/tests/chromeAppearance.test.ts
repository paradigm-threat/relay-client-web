import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeChromeThemePref,
  resolveChromeScheme,
  applyChromeAppearance,
} from '../theme/chromeAppearance.ts'

test('normalize maps default to system', () => {
  assert.equal(normalizeChromeThemePref('default'), 'system')
  assert.equal(normalizeChromeThemePref('light'), 'light')
  assert.equal(normalizeChromeThemePref('dark'), 'dark')
  assert.equal(normalizeChromeThemePref('system'), 'system')
  assert.equal(normalizeChromeThemePref(null), 'system')
})

test('system follows prefers-color-scheme', () => {
  assert.equal(resolveChromeScheme('system', true), 'dark')
  assert.equal(resolveChromeScheme('system', false), 'light')
  assert.equal(resolveChromeScheme('light', true), 'light')
  assert.equal(resolveChromeScheme('dark', false), 'dark')
})

test('applyChromeAppearance sets html class and color-scheme', () => {
  const el = {
    classList: {
      tokens: new Set<string>(),
      remove (...names: string[]) {
        names.forEach((n) => this.tokens.delete(n))
      },
      add (...names: string[]) {
        names.forEach((n) => this.tokens.add(n))
      },
    },
    attrs: {} as Record<string, string>,
    style: { colorScheme: '' },
    setAttribute (k: string, v: string) {
      this.attrs[k] = v
    },
  }
  applyChromeAppearance('system', el as unknown as HTMLElement, true)
  assert.equal(el.classList.tokens.has('dark'), true)
  assert.equal(el.classList.tokens.has('light'), false)
  assert.equal(el.attrs['data-relay-chrome-theme'], 'system')
  assert.equal(el.style.colorScheme, 'dark')
})
