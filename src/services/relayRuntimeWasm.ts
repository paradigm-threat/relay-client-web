/**
 * Shared relay-runtime WASM init + markdown AST helper for the web client.
 */
import initRelay, { markdown_to_ast_json } from '../wasm/relay_runtime_pkg/relay_runtime.js'

const RELAY_RUNTIME_WASM_WEB_PATH = '/wasm/relay_runtime_pkg/relay_runtime_bg.wasm'

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

let initPromise: Promise<unknown> | null = null

export async function ensureRelayRuntimeWasm (): Promise<void> {
  if (!initPromise) {
    initPromise = initRelay({ module_or_path: relayRuntimeWasmUrl() })
  }
  await initPromise
}

/** Default HTML allowlist — keep in sync with relay-runtime `default_allowed_html_tags`. */
const DEFAULT_ALLOWED_HTML_TAGS = [
  'span', 'div', 'math', 'annotation', 'semantics', 'mrow', 'mi', 'mo', 'mn',
  'msup', 'msub', 'mfrac', 'mtext',
]

export async function parseMarkdownToAstJson (
  markdown: string,
  allowedHtmlTags: string[] = DEFAULT_ALLOWED_HTML_TAGS,
): Promise<string> {
  await ensureRelayRuntimeWasm()
  return markdown_to_ast_json(markdown, JSON.stringify(allowedHtmlTags))
}
