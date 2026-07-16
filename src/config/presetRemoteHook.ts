/**
 * Preset fullscreen remote hook: resolve base URL (query → window → import.meta.env).
 */
import {
  DEFAULT_CLIENT_GET_HOOK_REPO_PATH,
  repoRelativeHookPathToUrlPath,
} from '../constants/relayClientDefaults.ts'

/** Stable tab id used with initPresetRemoteHookSession — do not closing in preset shell. */
export const PRESET_REMOTE_TAB_ID = 'preset-remote'

const QUERY_PRESET_HOOK = 'relay_preset_hook'

/**
 * Normalize a preset base URL: trim and strip trailing slashes; ensure parseable absolute URL.
 */
export function normalizePresetRemoteHookBase(raw: string): string {
  let s = raw.trim()
  if (!s) {
    throw new Error('preset remote hook base URL is empty')
  }
  s = s.replace(/\/+$/, '')
  try {
    // Require absolute URL so we append /hooks/... unambiguously
    const parsed = new URL(s)
    const path = parsed.pathname.replace(/\/+$/, '') || ''
    return `${parsed.origin}${path}`
  } catch {
    throw new Error(`preset remote hook base URL is not a valid absolute URL: ${raw}`)
  }
}

/**
 * Absolute URL for the default GET hook on the given preset base origin.
 */
export function buildDirectHookUrlFromPresetBase(normalizedBase: string): string {
  const normalized = normalizePresetRemoteHookBase(normalizedBase)
  const rel = repoRelativeHookPathToUrlPath(DEFAULT_CLIENT_GET_HOOK_REPO_PATH)
  return `${normalized}${rel}`
}

declare global {
  interface Window {
    RELAY_PUBLIC_PRESET_REMOTE_HOOK?: string
  }
}

export type PresetRemoteHookResolution =
  | { kind: 'none' }
  | { kind: 'ok'; base: string }
  | { kind: 'invalid'; raw: string; message: string }

function collectPresetRawCandidates (): string[] {
  const out: string[] = []
  if (typeof window !== 'undefined' && typeof window.location?.search === 'string') {
    try {
      const q = new URLSearchParams(window.location.search).get(QUERY_PRESET_HOOK)
      if (q) out.push(q)
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined' && typeof window.RELAY_PUBLIC_PRESET_REMOTE_HOOK === 'string') {
    out.push(window.RELAY_PUBLIC_PRESET_REMOTE_HOOK)
  }
  /** Injected by esbuild (`define`) when set in `.env`; optional at runtime. */
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  const fromBuild = env?.RELAY_PUBLIC_PRESET_REMOTE_HOOK
  if (typeof fromBuild === 'string' && fromBuild.trim() !== '') {
    out.push(fromBuild.trim())
  }
  return out
}

/**
 * Full resolution for preset mode (valid / invalid / unset).
 * Precedence: URL param → window → import.meta.env (first non-empty raw win).
 */
export function resolvePresetRemoteHook (): PresetRemoteHookResolution {
  let chosen = ''
  for (const candidate of collectPresetRawCandidates()) {
    const t = candidate.trim()
    if (t) {
      chosen = t
      break
    }
  }
  if (!chosen) return { kind: 'none' }
  try {
    return { kind: 'ok', base: normalizePresetRemoteHookBase(chosen) }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { kind: 'invalid', raw: chosen, message }
  }
}