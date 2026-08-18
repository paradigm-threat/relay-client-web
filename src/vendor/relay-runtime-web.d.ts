/**
 * relay-runtime web integration
 */

export interface BootstrapOptions {
  rootId?: string;
  styleId?: string;
  themePath?: string;
  hooksPath?: string;
  appPath?: string;
  baseUrl?: string;
  wasmUrl?: string | URL;
}

/**
 * Bootstrap relay-runtime: load WASM, fetch config and hooks, run app, inject CSS, render to DOM.
 */
export function bootstrap(options?: BootstrapOptions): Promise<void>;

/**
 * Options for renderHook().
 */
export interface RenderHookOptions {
  hookPath?: string;
  host?: string;
  baseUrl?: string;
  /** Reuse existing SSR DOM in container (data-relay-ssr=1) and attach handlers. */
  hydrate?: boolean;
  /** Branch tip used during SSR (`X-Relay-Branch` on host fetches). */
  branch?: string;
  /** Document path SSR used (`relayInitialPath` in hooks manifest). */
  initialPath?: string;
  /** Optional theme YAML; when omitted, fetched from known theme paths on host. */
  themeYaml?: string;
  /** Boot mode: auto (hydrate when data-relay-ssr=1), csr, or hydrate. */
  mode?: 'auto' | 'csr' | 'hydrate';
}

/** Scan hook source for local `from '…'` / `from "…"` import specs. */
export function localImportSpecs(source: string): string[];

/** Resolve a local import spec relative to the importing module path. */
export function resolveImportRel(importer: string, spec: string): string;

/** Insert module source under both `rel` and `/rel`. */
export function putModuleInMap(
  moduleMap: Record<string, string>,
  pathKey: string,
  text: string,
): void;

/** True when text looks like hook source, not an HTML fallback page. */
export function looksLikeHookSource(text: string): boolean;

/** Max modules loaded by CSR import-graph walk. */
export const IMPORT_CLOSURE_MAX_MODULES: number;

/**
 * BFS of static local imports (CSR parity with gateway SSR import closure).
 * `fetchSource` returns module text or null when missing.
 */
export function preloadImportClosure(
  moduleMap: Record<string, string>,
  fetchSource: (rel: string) => Promise<string | null | undefined>,
  onLoaded?: (rel: string) => void,
): Promise<Record<string, string>>;

export interface BootStatus {
  phase: string;
  message: string;
  detail: string;
  progress: string;
}

/** Publish boot phase to mount element (dataset + relay-boot-status event). */
export function setBootStatus(
  container: HTMLElement | null | undefined,
  status?: { phase?: string; message?: string; detail?: string; progress?: string },
): void;

/** Read boot status from container dataset or last global status. */
export function getBootStatus(container?: HTMLElement | null): BootStatus;

/** Install globalThis.__relay_host_fetch for CleverScript Host.fetch (sync XHR). Idempotent. */
export function installRelayHostFetch(): void;

/** Resolve CleverScript `fetch('/path')` against remote hook gateway base. */
export function setRelayFetchBaseUrl(baseUrl?: string): void;

/** Prefer the same branch SSR used (`X-Relay-Branch` on host fetches). */
export function setRelayFetchBranch(branch?: string): void;

/**
 * Render a structured hook error panel (message, URL/status, repo/branch, CleverScript
 * diagnostics). `keepContent: true` prepends the panel and preserves existing SSR markup.
 */
export function renderHookErrorUI(
  container: HTMLElement,
  err: unknown,
  opts?: { keepContent?: boolean; title?: string },
): void;

/**
 * Run a hook (local or remote) and render into container. Used by relay-hook-renderer.
 */
export function renderHook(
  container: HTMLElement,
  options?: RenderHookOptions
): Promise<void>;

/**
 * Hydrate existing SSR markup in `container` from a VNode tree. Returns false on mismatch.
 */
export function hydrateVnode(
  v: unknown,
  container: HTMLElement,
  invokeHandler?: (id: number) => void,
  onAfterInvoke?: (() => void) | null,
): boolean;

/**
 * Resolve a hook/manifest path against a base URL (absolute, root-relative, relative).
 */
export function resolveHookUrl(baseUrl: string, path: string): string;

/**
 * Convert VNode JSON to DOM nodes.
 */
export function vnodeToDom(v: unknown): DocumentFragment | HTMLElement | Text | null;

/**
 * Get available theme names. Call after bootstrap().
 */
export function getThemes(): string[];

/**
 * Set current theme and update styles. Use with theme toggle buttons (data-theme="...").
 */
export function setCurrentTheme(name: string): void;

/** Mark embed client live after hydrate/CSR (CleverScript isClientLive).
 * Host also sets html[data-pt-hydrated]="1" via syncHtmlHydratedAttr. */
export function setClientLive(live: boolean): void;

