import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyAddedUrl,
  defaultMasterOrigins,
  hostnameOf,
  isKnownNodeApex,
  isLegacyPeerList,
  migrateStoredPeerHosts,
  originOf,
  repoSiteOrigin,
} from '../constants/liveFleet.ts'
import { isNodeStatusPayload } from '../services/nodeStatus.ts'
import { detectClientHook, unsupportedMessage } from '../services/hookDetect.ts'

test('defaultMasterOrigins is the live fleet', () => {
  const o = defaultMasterOrigins()
  assert.deepEqual(o, [
    'https://dfw1.relaygateway.net',
    'https://lon1.relaygateway.net',
    'https://hkg1.relaygateway.net',
  ])
})

test('legacy atlanta2 list is replaced', () => {
  const next = migrateStoredPeerHosts(['https://atlanta2.relaygateway.net'])
  assert.ok(next.some((h) => h.includes('dfw1')))
  assert.ok(!next.some((h) => h.includes('atlanta2')))
})

test('empty stored list is replaced', () => {
  assert.equal(migrateStoredPeerHosts([]).length, 3)
  assert.equal(isLegacyPeerList([]), true)
})

test('user-added live node is kept', () => {
  const stored = ['https://dfw1.relaygateway.net', 'https://relay.example.com']
  assert.deepEqual(migrateStoredPeerHosts(stored), stored)
})

test('env list with atlanta2 falls back to live defaults', () => {
  const o = defaultMasterOrigins('https://atlanta2.relaygateway.net')
  assert.ok(o.some((h) => h.includes('dfw1')))
})

test('classify node apex vs repo subdomain vs parked site', () => {
  assert.equal(classifyAddedUrl('https://dfw1.relaygateway.net').kind, 'node')
  assert.equal(classifyAddedUrl('dfw1.relaygateway.net').kind, 'node')
  const repo = classifyAddedUrl('https://paradigm-threat-files.dfw1.relaygateway.net/')
  assert.equal(repo.kind, 'site')
  assert.equal(hostnameOf(repo.origin), 'paradigm-threat-files.dfw1.relaygateway.net')
  assert.equal(classifyAddedUrl('https://paradigmthreat.net').kind, 'site')
})

test('isKnownNodeApex does not treat repo hosts as nodes', () => {
  assert.equal(isKnownNodeApex('dfw1.relaygateway.net'), true)
  assert.equal(isKnownNodeApex('paradigm-threat-files.dfw1.relaygateway.net'), false)
})

test('repoSiteOrigin builds {repo}.{node}', () => {
  assert.equal(
    repoSiteOrigin('paradigm-threat-files', 'dfw1.relaygateway.net'),
    'https://paradigm-threat-files.dfw1.relaygateway.net',
  )
})

test('originOf adds https', () => {
  assert.equal(originOf('lon1.relaygateway.net'), 'https://lon1.relaygateway.net')
})

test('isNodeStatusPayload requires schema, healthy, repos', () => {
  assert.equal(isNodeStatusPayload({ schema_version: 2, healthy: true, repos: [] }), true)
  assert.equal(isNodeStatusPayload({ ok: true }), false)
  assert.equal(isNodeStatusPayload(null), false)
})

test('detectClientHook 200 vs 404 vs cors', async () => {
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('missing.example')) {
      return new Response('nope', { status: 404 })
    }
    if (url.includes('blocked.example')) {
      throw new TypeError('Failed to fetch')
    }
    if (url.includes('html.example')) {
      return new Response('<html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    }
    return new Response('export default function () {}', {
      status: 200,
      headers: { 'content-type': 'text/javascript' },
    })
  }) as typeof fetch
  try {
    const ok = await detectClientHook('https://ok.example')
    assert.equal(ok.ok, true)
    const missing = await detectClientHook('https://missing.example')
    assert.equal(missing.ok, false)
    if (!missing.ok) assert.equal(missing.reason, 'not_found')
    const blocked = await detectClientHook('https://blocked.example')
    assert.equal(blocked.ok, false)
    if (!blocked.ok) assert.equal(blocked.reason, 'cors')
    const html = await detectClientHook('https://html.example')
    assert.equal(html.ok, false)
    if (!html.ok) assert.equal(html.reason, 'invalid')
  } finally {
    globalThis.fetch = orig
  }
})

test('unsupportedMessage is explicit', () => {
  assert.match(unsupportedMessage('not_found'), /Not supported/)
  assert.match(unsupportedMessage('cors'), /Not supported/)
})
