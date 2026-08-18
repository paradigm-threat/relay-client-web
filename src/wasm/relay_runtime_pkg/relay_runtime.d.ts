/* tslint:disable */
/* eslint-disable */

/**
 * Returns true if a setter ran since last run (host should re-run and re-render), and clears the flag.
 */
export function consume_render_requested(): boolean;

export function get_android_styles(state_json: string, selector: string, classes_json: string): string;

/**
 * Last theme name passed to `setCurrentTheme` / `set_theme_and_render`.
 */
export function get_current_theme_name(): string;

export function get_default_state_json(): string;

/**
 * Return CSS injected by the hook via injectStyles(). Call after run_hook_with_host.
 * Prefers a forced theme stylesheet from `setCurrentTheme` when present.
 */
export function get_injected_css(): string;

/**
 * Get pending messages from host (pushed via push_message_from_host) and clear the queue.
 * Returns JSON array of message payloads (parsed when valid JSON, else as string).
 */
export function get_pending_messages(): string;

/**
 * Get all theme keys and names as JSON array: [{ "key": "default", "name": "Default Theme" }, ...]
 * Returns array of themes from the state JSON.
 */
export function get_theme_list_json(state_json: string): string;

/**
 * Get theme list JSON from last state. Call after run_hook_with_host.
 */
export function get_themes(): string;

export function get_version(): string;

/**
 * Invoke a handler by ID (from VNode props with type "Handler"). Used when the host
 * receives a click or other event and needs to run the callback (e.g. onClick).
 */
export function invoke_handler(handler_id: number): void;

/**
 * Whether interactive controls should enable (`isClientLive()` in CleverScript).
 */
export function is_client_live(): boolean;

/**
 * Parse Markdown to a JSON AST using **md2ast** (same crate as gateway should use for parity).
 *
 * Returns a JSON array of tagged nodes (`{ "type": "element", ... }` | `{ "type": "text", ... }`).
 * `allowed_html_tags_json` is a JSON array of lowercase tag names for inline HTML in markdown
 * (e.g. `["span","div","math"]`). Use `[]` to disallow raw HTML tags in source.
 */
export function markdown_to_ast_json(markdown: string, allowed_html_tags_json: string): string;

/**
 * Post a message to the host via window.postMessage. Host receives via addEventListener("message", ...).
 * Payload is wrapped as { type: "relay-runtime", payload } so host can filter.
 */
export function post_message_to_host(payload_json: string): void;

/**
 * Push a message from host into the runtime queue. Call from host's message handler when forwarding.
 * Returns JSON array of pending messages and clears the queue.
 */
export function push_message_from_host(payload_json: string): void;

export function render_css_for_web(state_json: string): string;

/**
 * Run hook source and return VNode tree as JSON for host to apply to DOM.
 *
 * Returns JSON string of the normalized VNode, or error on failure.
 * For parse errors, the error string is JSON `{message, line, column, file?, source_line?}` for advanced UI.
 * Errors and warnings are forwarded to the browser console.
 */
export function run_hook(source: string): string;

/**
 * Run hook with optional filename for verbose parse errors (file:line:column).
 */
export function run_hook_with_file(source: string, file: string): string;

/**
 * Run hook with a module map for dynamic import() support.
 * module_map_json: JSON object mapping path -> source, e.g. {"../foo.jsx": "export default..."}
 * theme_yaml: legacy host theme; pass "" — hooks load theme via `@clevertree/style` StyleContext.
 * hooks_manifest_json: JSON string of {hooks: [{id, name, path}, ...]}. Pass "" if none. Hook can import("@hooks").
 * file: Optional filename for parse errors (e.g. "app.jsx"). Pass "" for none.
 */
export function run_hook_with_host(source: string, module_map_json: string, theme_yaml: string, hooks_manifest_json: string, file: string): string;

/**
 * Mark the embed client as live (post-hydrate / CSR). CleverScript `isClientLive()`.
 */
export function set_client_live(live: boolean): void;

/**
 * Set current theme, update LAST_STATE, and return single-theme CSS for immediate apply.
 */
export function set_theme_and_render(theme_name: string): string;

export function set_theme_json(state_json: string, theme_name: string): string;

/**
 * Enable or disable verbose mode. When enabled, run_hook logs each hook execution,
 * and the host should log fetches and file loads.
 */
export function set_verbose(enabled: boolean): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly consume_render_requested: () => number;
    readonly get_current_theme_name: () => [number, number];
    readonly get_injected_css: () => [number, number];
    readonly get_pending_messages: () => [number, number];
    readonly get_themes: () => [number, number];
    readonly invoke_handler: (a: number) => [number, number];
    readonly is_client_live: () => number;
    readonly markdown_to_ast_json: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly post_message_to_host: (a: number, b: number) => [number, number];
    readonly push_message_from_host: (a: number, b: number) => void;
    readonly run_hook: (a: number, b: number) => [number, number, number, number];
    readonly run_hook_with_file: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly run_hook_with_host: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number, number];
    readonly set_client_live: (a: number) => void;
    readonly set_theme_and_render: (a: number, b: number) => [number, number];
    readonly set_verbose: (a: number) => void;
    readonly get_android_styles: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly get_default_state_json: () => [number, number];
    readonly get_theme_list_json: (a: number, b: number) => [number, number];
    readonly get_version: () => [number, number];
    readonly render_css_for_web: (a: number, b: number) => [number, number];
    readonly set_theme_json: (a: number, b: number, c: number, d: number) => [number, number];
    readonly themed_styler_free_string: (a: number) => void;
    readonly themed_styler_render_css: (a: number) => number;
    readonly themed_styler_version: () => number;
    readonly wasm_bindgen__closure__destroy__h70836fd6b4c627df: (a: number, b: number) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h50d33f36c27ea276: (a: number, b: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
