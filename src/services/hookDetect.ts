import {
  DEFAULT_CLIENT_GET_HOOK_REPO_PATH,
  repoRelativeHookPathToUrlPath,
} from '../constants/relayClientDefaults.ts'

export type HookDetectReason = 'not_found' | 'cors' | 'network' | 'invalid'

export type HookDetectResult =
  | { ok: true; hookPath: string }
  | { ok: false; reason: HookDetectReason }

function hookUrl (origin: string, hookPath: string): string {
  const base = origin.replace(/\/+$/, '')
  const path = repoRelativeHookPathToUrlPath(hookPath)
  return `${base}${path}`
}

async function readOptionsHookPath (origin: string): Promise<string | null> {
  const base = origin.replace(/\/+$/, '')
  try {
    const resp = await fetch(`${base}/`, {
      method: 'OPTIONS',
      headers: { Accept: 'application/json' },
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as {
      client?: { hooks?: { get?: { path?: string } } }
    }
    const p = data?.client?.hooks?.get?.path
    if (typeof p === 'string' && p.trim()) return p.trim()
    return null
  } catch {
    return null
  }
}

export async function detectClientHook (
  origin: string,
  hookPath = DEFAULT_CLIENT_GET_HOOK_REPO_PATH,
): Promise<HookDetectResult> {
  const url = hookUrl(origin, hookPath)
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/octet-stream, text/javascript, text/plain, */*' },
    })
    if (resp.ok) {
      const ct = (resp.headers.get('content-type') || '').toLowerCase()
      if (ct.includes('text/html')) {
        return { ok: false, reason: 'invalid' }
      }
      return { ok: true, hookPath: repoRelativeHookPathToUrlPath(hookPath) }
    }
    return { ok: false, reason: 'not_found' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/failed to fetch|networkerror|cors/i.test(msg)) {
      return { ok: false, reason: 'cors' }
    }
    return { ok: false, reason: 'network' }
  }
}

/** OPTIONS for hook path when available, then GET the hook file. */
export async function detectClientHookWithOptions (origin: string): Promise<HookDetectResult> {
  const fromOptions = await readOptionsHookPath(origin)
  const path = fromOptions || DEFAULT_CLIENT_GET_HOOK_REPO_PATH
  return detectClientHook(origin, path)
}

export function unsupportedMessage (reason: HookDetectReason): string {
  switch (reason) {
    case 'not_found':
      return 'Not supported — this site has no Relay client hook (hooks/client/get.jsx).'
    case 'cors':
      return 'Not supported — could not verify a client hook (CORS or network blocked the check).'
    case 'invalid':
      return 'Not supported — the hook URL returned HTML instead of a client hook.'
    default:
      return 'Not supported — this site is not a Relay client-hook origin.'
  }
}
