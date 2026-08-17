/**
 * Fleet-style node probe: POST /api/status (JSON). Same payload relay-ops uses.
 */

export interface NodeStatusRepo {
  name: string
  on_disk: boolean
  in_catalog: boolean
  ok: boolean
  publish_branch?: string
  publish_sha?: string
  head_branch?: string
  head_sha?: string
  branch_count?: number
}

export interface NodeStatusSelf {
  gateway_version?: string
  node_fqdn?: string
  repo_count?: number
  relay_server_id?: string
  mesh_role?: string
}

export interface NodeStatus {
  schema_version: number
  status: string
  healthy: boolean
  self?: NodeStatusSelf
  repos?: NodeStatusRepo[]
}

export function isNodeStatusPayload (v: unknown): v is NodeStatus {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.schema_version === 'number'
    && typeof o.healthy === 'boolean'
    && Array.isArray(o.repos)
  )
}

export type FetchNodeStatusResult =
  | { ok: true; status: NodeStatus; latencyMs: number }
  | { ok: false; error: string }

export async function fetchNodeStatus (
  nodeOrigin: string,
  timeoutMs = 8000,
): Promise<FetchNodeStatusResult> {
  const origin = nodeOrigin.replace(/\/+$/, '')
  const url = `${origin}/api/status?format=json`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    const latencyMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}` }
    }
    const data: unknown = await resp.json()
    if (!isNodeStatusPayload(data)) {
      return { ok: false, error: 'not a relay /api/status payload' }
    }
    return { ok: true, status: data, latencyMs }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const aborted = e instanceof Error && e.name === 'AbortError'
    return { ok: false, error: aborted ? 'timeout' : msg }
  } finally {
    clearTimeout(timer)
  }
}
