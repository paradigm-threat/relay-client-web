import { useEffect, useState } from 'react'
import { TSDiv } from './TSDiv'
import HookRenderer from './ThemedHookRenderer'
import { parseMarkdownToAstJson } from '../services/relayRuntimeWasm'

const HOOK_PATH = '/hooks/client/get.jsx'
const HOOK_HOST = 'http://localhost:8002'

const SAMPLE_MD = `# Markdown → md2jsx (WASM)\n\n**relay-runtime** parses this via \`markdown_to_ast_json\`.\n\n- Item one\n- Item two\n`

export function TestTab () {
  const transpilerVersion = (globalThis as { __hook_transpiler_version?: string }).__hook_transpiler_version || 'not loaded'
  const [astJson, setAstJson] = useState<string>('')
  const [astErr, setAstErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const j = await parseMarkdownToAstJson(SAMPLE_MD, [])
        if (!cancelled) {
          setAstJson(j)
          setAstErr(null)
        }
      } catch (e) {
        if (!cancelled) setAstErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <TSDiv className="flex flex-col h-full w-full overflow-auto">
      <TSDiv className="p-4 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <TSDiv className="flex items-baseline justify-between mb-3">
          <TSDiv tag="h2" className="text-xl font-bold">Test tab</TSDiv>
          <TSDiv className="text-xs text-[var(--text-secondary)]">
            Transpiler: v{transpilerVersion}
          </TSDiv>
        </TSDiv>
        <TSDiv className="text-sm text-[var(--text-secondary)] mt-2">
          <strong>md2jsx via relay-runtime WASM</strong>
          {' '}
          — sample AST (from bundled <code>markdown_to_ast_json</code>):
        </TSDiv>
        {astErr
          ? (
            <TSDiv className="mt-2 text-red-600 text-sm">{astErr}</TSDiv>
            )
          : (
            <TSDiv tag="pre" className="mt-2 text-xs overflow-auto max-h-40 bg-black/5 dark:bg-white/5 p-2 rounded">
              {astJson || '…loading'}
            </TSDiv>
            )}
      </TSDiv>
      <TSDiv className="p-4 text-sm text-[var(--text-secondary)] border-b border-[var(--border)]">
        <TSDiv tag="p">
          Hook stub host <code>{HOOK_HOST}</code> path <code>{HOOK_PATH}</code>
        </TSDiv>
      </TSDiv>
      <TSDiv className="flex-1 overflow-hidden">
        <HookRenderer
          host={HOOK_HOST}
          hookPath={HOOK_PATH}
        />
      </TSDiv>
    </TSDiv>
  )
}
