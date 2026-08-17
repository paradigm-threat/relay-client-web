/**
 * Live production masters (same default as relay-gateway installer's
 * DEFAULT_RELAY_MASTER_PEER_LIST). Atlanta2 and other Linode names are legacy.
 */
export const LIVE_MASTER_ORIGINS = [
  'https://dfw1.relaygateway.net',
  'https://lon1.relaygateway.net',
  'https://hkg1.relaygateway.net',
] as const

const LEGACY_PEER_HOST_MARKERS = ['atlanta2', 'atlanta3', 'jp-osa']

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
  return stored.map((s) => s.trim()).filter((s) => s.length > 0)
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
