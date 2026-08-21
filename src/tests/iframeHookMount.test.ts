import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import {
  csrHostBootOverlayEnabled,
  ensureIframeDocumentBase,
  parkedSiteBaseHref,
} from '../iframeHookMount.ts'

test('parkedSiteBaseHref is origin with trailing slash', () => {
  assert.equal(
    parkedSiteBaseHref('https://paradigm-threat-files.iad1.relaygateway.net'),
    'https://paradigm-threat-files.iad1.relaygateway.net/',
  )
  assert.equal(
    parkedSiteBaseHref('https://paradigm-threat-files.iad1.relaygateway.net/'),
    'https://paradigm-threat-files.iad1.relaygateway.net/',
  )
  assert.equal(
    parkedSiteBaseHref('paradigm-threat-files.iad1.relaygateway.net'),
    'https://paradigm-threat-files.iad1.relaygateway.net/',
  )
})

test('parkedSiteBaseHref rejects non-http(s)', () => {
  assert.equal(parkedSiteBaseHref('javascript:alert(1)'), null)
  assert.equal(parkedSiteBaseHref('data:text/html,x'), null)
  assert.equal(parkedSiteBaseHref(''), null)
})

test('ensureIframeDocumentBase sets <base> so /site/header.png is parked-origin', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url: 'about:blank',
  })
  const host = 'https://paradigm-threat-files.iad1.relaygateway.net'
  const base = ensureIframeDocumentBase(dom.window.document, host)
  assert.ok(base)
  assert.equal(base?.getAttribute('href'), `${host}/`)

  const img = dom.window.document.createElement('img')
  img.setAttribute('src', '/site/header.png')
  dom.window.document.body.appendChild(img)
  assert.equal(img.src, `${host}/site/header.png`)
  dom.window.close()
})

test('csrHostBootOverlayEnabled is off only for explicit hydrate', () => {
  assert.equal(csrHostBootOverlayEnabled('csr'), true)
  assert.equal(csrHostBootOverlayEnabled('auto'), true)
  assert.equal(csrHostBootOverlayEnabled(undefined), true)
  assert.equal(csrHostBootOverlayEnabled('hydrate'), false)
})
