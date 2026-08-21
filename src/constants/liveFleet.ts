/**
 * Live production masters (same default as relay-gateway installer's
 * DEFAULT_RELAY_MASTER_PEER_LIST). Atlanta2 and other Linode names are legacy.
 */
export const LIVE_MASTER_ORIGINS = [
  'https://iad1.relaygateway.net',
  'https://sjc1.relaygateway.net',
  'https://hkg1.relaygateway.net',
] as const

const LEGACY_PEER_HOST_MARKERS = ['atlanta2', 'atlanta3', 'jp-osa']

/** Recycled / decommissioned node FQDNs rewritten to the current fleet. */
const RETIRED_NODE_REWRITES: Array<[RegExp, string]> = [
  [/lon1\.relaygateway\.net/gi, 'iad1.relaygateway.net'],
  [/dfw1\.relaygateway\.net/gi, 'sjc1.relaygateway.net'],
]

function rewriteRetiredNodeHosts (hosts: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of hosts) {
    let next = raw
    for (const [re, to] of RETIRED_NODE_REWRITES) {
      next = next.replace(re, to)
    }
    const key = hostnameOf(next)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(next)
  }
  return out
}

export function hostnameOf (originOrUrl: string): string {
  try {
    const u = originOrUrl.includes('://')
      ? new URL(originOrUrl)
      : new URL(`https://${originOrUrl}`)
    return u.hostname.toLowerCase()
  } catch {
    return originOrUrl.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase()
  }
}

export function originOf (input: string): string {
  try {
    const u = input.includes('://') ? new URL(input) : new URL(`https://${input}`)
    return u.origin
  } catch {
    const host = input.replace(/\/+$/, '')
    return `https://${host}`
  }
}

export function parsePeerList (raw?: string | null): string[] {
  if (!raw || !raw.trim()) return []
  return raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function isLegacyPeerHost (host: string): boolean {
  const hn = hostnameOf(host)
  return LEGACY_PEER_HOST_MARKERS.some((m) => hn.includes(m))
}

/** True when stored peers should be replaced by the live fleet defaults. */
export function isLegacyPeerList (hosts: string[]): boolean {
  if (hosts.length === 0) return true
  return hosts.every((h) => isLegacyPeerHost(h))
}

export function defaultMasterOrigins (envList?: string | null): string[] {
  const fromEnv = parsePeerList(envList)
  if (fromEnv.length > 0 && !isLegacyPeerList(fromEnv)) return fromEnv
  return [...LIVE_MASTER_ORIGINS]
}

/**
 * If localStorage still has atlanta2 (or an empty list), use live masters.
 * User-added live nodes are kept.
 */
export function migrateStoredPeerHosts (
  stored: string[] | null | undefined,
  envList?: string | null,
): string[] {
  const defaults = defaultMasterOrigins(envList)
  if (!stored || !Array.isArray(stored) || isLegacyPeerList(stored)) {
    return defaults
  }
  return rewriteRetiredNodeHosts(stored.map((s) => s.trim()).filter((s) => s.length > 0))
}

export function isKnownNodeApex (hostname: string, extraNodeHosts: string[] = []): boolean {
  const hn = hostname.toLowerCase()
  const known = [
    ...LIVE_MASTER_ORIGINS.map(hostnameOf),
    ...extraNodeHosts.map(hostnameOf),
  ]
  return known.includes(hn)
}

export function isRepoSubdomainOfNode (hostname: string, nodeFqdn: string): boolean {
  const h = hostname.toLowerCase()
  const n = nodeFqdn.toLowerCase()
  return n.length > 0 && h !== n && h.endsWith(`.${n}`)
}

export function repoSiteOrigin (repo: string, nodeFqdn: string): string {
  const name = repo.trim()
  const node = nodeFqdn.replace(/^https?:\/\//i, '').split('/')[0]
  return `https://${name}.${node}`
}

/** Minimal peer shape for mirror ranking (avoids importing the Zustand store). */
export type MirrorPeer = {
  host: string
  nodeFqdn?: string
  healthy?: boolean
  probes?: Array<{ ok: boolean; latencyMs?: number }>
  statusRepos?: Array<{
    name: string
    on_disk?: boolean
    in_catalog?: boolean
    ok?: boolean
    description?: string
    publish_branch?: string
    publish_sha?: string
  }>
  repos?: string[]
}

export function peerIsReachable (peer: MirrorPeer): boolean {
  const probes = peer.probes || []
  if (probes.length === 0) return false
  return probes.some((p) => p.ok)
}

export function peerLatencyMs (peer: MirrorPeer): number {
  const ok = (peer.probes || []).filter((p) => p.ok && p.latencyMs != null)
  if (ok.length === 0) return Number.POSITIVE_INFINITY
  return Math.min(...ok.map((p) => p.latencyMs as number))
}

/** First reachable node in list order — catalog source of truth, then failover. */
export function firstReachablePeer<T extends MirrorPeer> (peers: T[]): T | null {
  for (const p of peers) {
    if (peerIsReachable(p)) return p
  }
  return null
}

export function catalogRowsFromPeer (peer: MirrorPeer | null): NonNullable<MirrorPeer['statusRepos']> {
  if (!peer?.statusRepos) return []
  const catalog = peer.statusRepos.filter((r) => r.in_catalog !== false)
  const extras = peer.statusRepos.filter((r) => r.in_catalog === false && r.on_disk)
  const byName = new Map<string, (typeof catalog)[number]>()
  for (const r of [...catalog, ...extras]) {
    if (!byName.has(r.name)) byName.set(r.name, r)
  }
  return [...byName.values()]
}

function peerHasRepo (peer: MirrorPeer, repo: string): boolean {
  if (peer.statusRepos?.some((r) => r.name === repo && r.on_disk !== false)) return true
  return (peer.repos || []).includes(repo)
}

let mirrorRoundRobin = 0

/**
 * Pick `{repo}.{node}` among live peers the way parked sites do: prefer the
 * lowest-latency healthy mirror, and rotate among mirrors in a close band so
 * one node is not pinned.
 */
export function pickRepoMirror (
  repo: string,
  peers: MirrorPeer[],
  roundRobin: () => number = () => ++mirrorRoundRobin,
): string | null {
  const name = repo.trim()
  if (!name || peers.length === 0) return null

  const withRepo = peers.filter((p) => peerIsReachable(p) && peerHasRepo(p, name))
  const reachable = peers.filter(peerIsReachable)
  const pool = withRepo.length > 0 ? withRepo : reachable.length > 0 ? reachable : peers
  const ranked = pool
    .map((p) => ({
      peer: p,
      latency: peerLatencyMs(p),
      healthy: peerIsReachable(p),
      origin: repoSiteOrigin(name, p.nodeFqdn || hostnameOf(p.host)),
    }))
    .sort((a, b) => {
      if (a.healthy !== b.healthy) return a.healthy ? -1 : 1
      return a.latency - b.latency
    })
  if (ranked.length === 0) return null

  const best = ranked[0]
  const band = ranked.filter((c) => {
    if (c.healthy !== best.healthy) return false
    if (!Number.isFinite(best.latency)) return true
    return c.latency <= best.latency * 1.25 || c.latency - best.latency <= 80
  })
  const pick = band[Math.abs(roundRobin()) % band.length]
  return pick.origin
}

export type ClassifiedUrl =
  | { kind: 'node'; origin: string }
  | { kind: 'site'; origin: string }

/**
 * Classify a pasted URL: node apex (list repos) vs site/parked host (hook detect).
 * Repo subdomains of known nodes are sites, not nodes.
 */
export function classifyAddedUrl (input: string, knownNodeHosts: string[] = []): ClassifiedUrl {
  const origin = originOf(input.trim())
  const hn = hostnameOf(origin)
  const nodeHosts = [...LIVE_MASTER_ORIGINS, ...knownNodeHosts]
  for (const n of nodeHosts) {
    const nodeHn = hostnameOf(n)
    if (isRepoSubdomainOfNode(hn, nodeHn)) {
      return { kind: 'site', origin }
    }
  }
  if (isKnownNodeApex(hn, knownNodeHosts)) {
    return { kind: 'node', origin }
  }
  return { kind: 'site', origin }
}
