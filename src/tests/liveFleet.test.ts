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
  pickRepoMirror,
  repoSiteOrigin,
  firstReachablePeer,
  catalogRowsFromPeer,
  peerIsReachable,
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

test('pickRepoMirror prefers healthy low-latency and rotates in-band', () => {
  const peers = [
    {
      host: 'https://lon1.relaygateway.net',
      nodeFqdn: 'lon1.relaygateway.net',
      healthy: true,
      probes: [{ ok: true, latencyMs: 220 }],
      statusRepos: [{ name: 'files', on_disk: true }],
    },
    {
      host: 'https://dfw1.relaygateway.net',
      nodeFqdn: 'dfw1.relaygateway.net',
      healthy: true,
      probes: [{ ok: true, latencyMs: 40 }],
      statusRepos: [{ name: 'files', on_disk: true }],
    },
    {
      host: 'https://hkg1.relaygateway.net',
      nodeFqdn: 'hkg1.relaygateway.net',
      healthy: false,
      probes: [{ ok: false }],
      statusRepos: [{ name: 'files', on_disk: true }],
    },
  ]
  const a = pickRepoMirror('files', peers, () => 0)
  const b = pickRepoMirror('files', peers, () => 1)
  assert.equal(a, 'https://files.dfw1.relaygateway.net')
  // lon1 is outside the 80ms/25% band of 40ms, so rotation stays on dfw1
  assert.equal(b, 'https://files.dfw1.relaygateway.net')
})

test('pickRepoMirror rotates among close healthy mirrors', () => {
  const peers = [
    {
      host: 'https://dfw1.relaygateway.net',
      nodeFqdn: 'dfw1.relaygateway.net',
      healthy: true,
      probes: [{ ok: true, latencyMs: 50 }],
      statusRepos: [{ name: 'files', on_disk: true }],
    },
    {
      host: 'https://lon1.relaygateway.net',
      nodeFqdn: 'lon1.relaygateway.net',
      healthy: true,
      probes: [{ ok: true, latencyMs: 55 }],
      statusRepos: [{ name: 'files', on_disk: true }],
    },
  ]
  const first = pickRepoMirror('files', peers, () => 0)
  const second = pickRepoMirror('files', peers, () => 1)
  assert.equal(first, 'https://files.dfw1.relaygateway.net')
  assert.equal(second, 'https://files.lon1.relaygateway.net')
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

test('firstReachablePeer fails over in list order', () => {
  const peers = [
    { host: 'https://dfw1.relaygateway.net', probes: [{ ok: false }] },
    { host: 'https://lon1.relaygateway.net', probes: [{ ok: true, latencyMs: 80 }] },
    { host: 'https://hkg1.relaygateway.net', probes: [{ ok: true, latencyMs: 20 }] },
  ]
  const p = firstReachablePeer(peers)
  assert.equal(p?.host, 'https://lon1.relaygateway.net')
})

test('catalogRowsFromPeer keeps catalog-only names ahead of extras', () => {
  const rows = catalogRowsFromPeer({
    host: 'https://dfw1.relaygateway.net',
    probes: [{ ok: true }],
    statusRepos: [
      { name: 'listed', in_catalog: true, on_disk: false, description: 'From catalog' },
      { name: 'live', in_catalog: true, on_disk: true, publish_sha: 'abc' },
      { name: 'extra', in_catalog: false, on_disk: true },
    ],
  })
  assert.deepEqual(rows.map((r) => r.name), ['listed', 'live', 'extra'])
  assert.equal(rows[0].description, 'From catalog')
})

test('peerIsReachable is this-client RTT, not mesh healthy', () => {
  assert.equal(
    peerIsReachable({ host: 'x', healthy: false, probes: [{ ok: true, latencyMs: 40 }] }),
    true,
  )
  assert.equal(
    peerIsReachable({ host: 'x', healthy: true, probes: [{ ok: false }] }),
    false,
  )
})
