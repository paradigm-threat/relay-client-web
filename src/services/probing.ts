/**
 * Node health + repo listing via POST /api/status (readable CORS JSON).
 * Do not use HEAD + no-cors: that cannot read fleet stats.
 */

import type { PeerProbe } from '../state/store'
import { fetchNodeStatus, type NodeStatus, type NodeStatusRepo } from './nodeStatus'

export interface FullProbeResult {
  probes: PeerProbe[]
  status?: NodeStatus
  repos?: string[]
  statusRepos?: NodeStatusRepo[]
  gatewayVersion?: string
  repoCount?: number
  nodeFqdn?: string
  healthy?: boolean
  lastUpdateTs?: number
}

export async function fullProbePeer (host: string): Promise<FullProbeResult> {
  const result = await fetchNodeStatus(host)
  if (!result.ok) {
    return {
      probes: [{
        protocol: 'https',
        port: 443,
        ok: false,
        error: result.error,
      }],
    }
  }
  const s = result.status
  const statusRepos = (s.repos || []).filter((r) => r.on_disk)
  return {
    probes: [{
      protocol: 'https',
      port: 443,
      ok: true,
      latencyMs: result.latencyMs,
    }],
    status: s,
    repos: statusRepos.map((r) => r.name),
    statusRepos,
    gatewayVersion: s.self?.gateway_version,
    repoCount: s.self?.repo_count ?? statusRepos.length,
    nodeFqdn: s.self?.node_fqdn,
    healthy: s.healthy,
    lastUpdateTs: Date.now(),
  }
}
