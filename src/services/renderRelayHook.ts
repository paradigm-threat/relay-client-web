/**
 * Initialise relay-runtime WASM once, then delegate to vendored relay-runtime-web `renderHook`.
 *
 * esbuild emits this package's WASM under `/wasm/relay_runtime_pkg/` (see copyWasmToAssets).
 * Bundled wasm-bindgen glue defaults to `relay_runtime_bg.wasm` next to the JS chunk (`/assets/…`),
 * where no such file exists; dev SPA fallback then returns `index.html` and instantiate() sees `<!do…`.
 */
import initRelay from '../wasm/relay_runtime_pkg/relay_runtime.js'

/** Disk / unpinned path (local `RELAY_STATIC_DIR`). */
const RELAY_RUNTIME_WASM_WEB_PATH = '/wasm/relay_runtime_pkg/relay_runtime_bg.wasm'

/**
 * When this module is served under `/assets/c/{oid}/…`, pin WASM to the same commit
 * so a page load never mixes tip A JS with tip B WASM (`RELAY_WEB_ASSETS.md`).
 */
function relayRuntimeWasmUrl (): string {
  try {
    const path = new URL(import.meta.url).pathname
    const m = path.match(/\/assets\/c\/([0-9a-f]{40})\//i)
    if (m?.[1]) {
      return `/wasm/c/${m[1]}/relay_runtime_pkg/relay_runtime_bg.wasm`
    }
  } catch {
    /* non-browser / odd URL */
  }
  return RELAY_RUNTIME_WASM_WEB_PATH
}

let initRelayPromise: Promise<unknown> | null = null

async function ensureRelayRuntimeInit (): Promise<void> {
  if (!initRelayPromise) {
    initRelayPromise = initRelay({ module_or_path: relayRuntimeWasmUrl() })
  }
  await initRelayPromise
}

export type MountRelayHookOpts = {
  host: string
  hookPath?: string
  hydrate?: boolean
  /** auto | csr | hydrate — default auto */
  mode?: 'auto' | 'csr' | 'hydrate'
  branch?: string
  initialPath?: string
  themeYaml?: string
}

export async function mountRelayHookIntoElement (
  el: HTMLElement,
  opts: MountRelayHookOpts,
): Promise<void> {
  await ensureRelayRuntimeInit()
  const { renderHook, installRelayHostFetch } = await import('../vendor/relay-runtime-web.js')
  installRelayHostFetch()
  const raw = opts.hookPath ?? 'hooks/client/get.jsx'
  const hookPath = raw.startsWith('/') ? raw.slice(1) : raw
  const hydrate = opts.hydrate === true || el.dataset?.relaySsr === '1'
  const mode =
    opts.mode ??
    (opts.hydrate === false ? 'csr' : opts.hydrate === true ? 'hydrate' : 'auto')
  await renderHook(el, {
    host: opts.host,
    hookPath,
    hydrate,
    mode,
    branch: opts.branch,
    initialPath: opts.initialPath,
    themeYaml: opts.themeYaml,
  })
}

export type EmbedConfig = {
  repo: string
  branch: string
  initialPath: string
  clientHookPath: string
}

export function readEmbedConfig (): EmbedConfig {
  const cfgEl = document.getElementById('relay-embed-config')
  const raw = cfgEl?.textContent?.trim()
  if (!raw) {
    throw new Error('[embed] missing #relay-embed-config')
  }
  return JSON.parse(raw) as EmbedConfig
}

/**
 * Hydrate an embed page whose `#root` already contains SSR markup (`data-relay-ssr="1"`).
 */
export async function hydrateEmbedRoot (rootEl: HTMLElement): Promise<void> {
  const cfg = readEmbedConfig()
  const host = typeof window !== 'undefined' ? window.location.origin : ''
  const hookPath = cfg.clientHookPath || '/hooks/client/get.jsx'
  await mountRelayHookIntoElement(rootEl, {
    host,
    hookPath,
    hydrate: true,
    branch: cfg.branch || '',
    initialPath: cfg.initialPath || '',
  })
}

/**
 * Boot the embed root: hydrate SSR markup when present, otherwise CSR-mount the same client hook.
 * Never falls back to React.
 */
export async function bootEmbedRoot (rootEl: HTMLElement): Promise<void> {
  const cfg = readEmbedConfig()
  const host = typeof window !== 'undefined' ? window.location.origin : ''
  const hookPath = cfg.clientHookPath || '/hooks/client/get.jsx'
  const hydrate = rootEl.dataset?.relaySsr === '1'
  rootEl.dataset.relayEmbed = '1'
  await mountRelayHookIntoElement(rootEl, {
    host,
    hookPath,
    hydrate,
    branch: cfg.branch || '',
    initialPath: cfg.initialPath || '',
  })
}
