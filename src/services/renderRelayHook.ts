/**
 * Initialise relay-runtime WASM once, then delegate to vendored relay-runtime-web `renderHook`.
 *
 * esbuild emits this package's WASM under `/wasm/relay_runtime_pkg/` (see copyWasmToAssets).
 * Bundled wasm-bindgen glue defaults to `relay_runtime_bg.wasm` next to the JS chunk (`/assets/…`),
 * where no such file exists; dev SPA fallback then returns `index.html` and instantiate() sees `<!do…`.
 */
import initRelay from '../wasm/relay_runtime_pkg/relay_runtime.js'

/** Root-relative URL copied to dist by the build step (matches relayRuntimeWasm `/wasm/` import). */
const RELAY_RUNTIME_WASM_WEB_PATH = '/wasm/relay_runtime_pkg/relay_runtime_bg.wasm'

let initRelayPromise: Promise<unknown> | null = null

async function ensureRelayRuntimeInit (): Promise<void> {
  if (!initRelayPromise) {
    initRelayPromise = initRelay({ module_or_path: RELAY_RUNTIME_WASM_WEB_PATH })
  }
  await initRelayPromise
}

export type MountRelayHookOpts = {
  host: string
  hookPath?: string
  hydrate?: boolean
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
  await renderHook(el, {
    host: opts.host,
    hookPath,
    hydrate,
    branch: opts.branch,
    initialPath: opts.initialPath,
    themeYaml: opts.themeYaml,
  })
}

/**
 * Hydrate an embed page whose `#root` already contains SSR markup (`data-relay-ssr="1"`).
 */
export async function hydrateEmbedRoot (rootEl: HTMLElement): Promise<void> {
  const cfgEl = document.getElementById('relay-embed-config')
  const raw = cfgEl?.textContent?.trim()
  if (!raw) {
    throw new Error('[hydrateEmbedRoot] missing #relay-embed-config')
  }
  const cfg = JSON.parse(raw) as {
    repo: string
    branch: string
    initialPath: string
    clientHookPath: string
  }
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
