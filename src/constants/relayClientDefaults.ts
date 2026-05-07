/**
 * Universal default GET hook path (repo-relative, as in `.relay.yaml` and OPTIONS).
 * HTTP URL path is `/hooks/client/get.jsx`.
 */
export const DEFAULT_CLIENT_GET_HOOK_REPO_PATH = 'hooks/client/get.jsx'

/** Turn repo-relative hook path into an absolute URL path on the relay host. */
export function repoRelativeHookPathToUrlPath (repoRelative: string): string {
  const p = repoRelative.trim().replace(/^\/+/, '')
  if (!p) return `/${DEFAULT_CLIENT_GET_HOOK_REPO_PATH}`
  return `/${p}`
}

export interface ClientHookGetInfo {
  client?: {
    hooks?: {
      get?: { path?: string }
      query?: { path?: string }
    }
  }
  [key: string]: unknown
}

/** Fills `client.hooks.get.path` when OPTIONS / legacy gateway omits it. */
export function applyDefaultClientGetHook<T extends ClientHookGetInfo> (options: T): T {
  const merged = { ...options } as ClientHookGetInfo & T
  if (!merged.client) merged.client = {}
  if (!merged.client.hooks) merged.client.hooks = {}
  if (!merged.client.hooks.get) merged.client.hooks.get = {}
  const p = merged.client.hooks.get.path?.trim()
  if (!p) {
    merged.client.hooks.get.path = DEFAULT_CLIENT_GET_HOOK_REPO_PATH
  }
  return merged as T
}
