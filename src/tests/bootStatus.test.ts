import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' })

before(() => {
  const { window } = dom
  globalThis.window = window as unknown as Window & typeof globalThis
  globalThis.document = window.document
  globalThis.CustomEvent = window.CustomEvent
})

after(() => {
  dom.window.close()
})

test('setBootStatus and getBootStatus round-trip on container dataset', async () => {
  const { setBootStatus, getBootStatus } = await import('../vendor/relay-runtime-web.js')
  const el = document.createElement('div')
  setBootStatus(el, { phase: 'modules', message: 'Fetching hooks 2/5…', progress: '2/5' })
  const st = getBootStatus(el)
  assert.equal(st.phase, 'modules')
  assert.equal(st.message, 'Fetching hooks 2/5…')
  assert.equal(st.progress, '2/5')
})
