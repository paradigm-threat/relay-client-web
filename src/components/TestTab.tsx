import { useEffect } from 'react'
import { TSDiv } from './TSDiv'
import HookRenderer from './ThemedHookRenderer'
import {
  normalizePresetRemoteHookBase,
  resolvePresetRemoteHook,
} from '../config/presetRemoteHook.ts'
import {
  DEFAULT_CLIENT_GET_HOOK_REPO_PATH,
  repoRelativeHookPathToUrlPath,
} from '../constants/relayClientDefaults.ts'
import { MarkdownRenderer, ensureRelayMarkdownWasm } from '../relayMarkdown'

const SAMPLE_MD = `# Markdown → md2ast (WASM)\n\n**relay-markdown** renders this via relay-runtime WASM.\n\n- Item one\n- Item two\n`

/** Default mirrors local static hook servers (same as preset docs); overridden when preset resolves. */
const DEFAULT_LOCAL_HOOK_ORIGIN = 'http://localhost:3011'

function resolveTestTabHookTarget (): { hookHost: string; hookPath: string } {
  const r = resolvePresetRemoteHook()
  if (r.kind === 'ok') {
    try {
      return {
        hookHost: normalizePresetRemoteHookBase(r.base),
        hookPath: repoRelativeHookPathToUrlPath(DEFAULT_CLIENT_GET_HOOK_REPO_PATH),
      }
    } catch {
      /* fall through */
    }
  }
  return {
    hookHost: DEFAULT_LOCAL_HOOK_ORIGIN,
    hookPath: repoRelativeHookPathToUrlPath(DEFAULT_CLIENT_GET_HOOK_REPO_PATH),
  }
}

export function TestTab () {
  const { hookHost, hookPath } = resolveTestTabHookTarget()

  const transpilerVersion = (globalThis as { __hook_transpiler_version?: string }).__hook_transpiler_version || 'not loaded'

  useEffect(() => {
    ensureRelayMarkdownWasm()
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
          <strong>md2ast via @clevertree/relay-markdown</strong>
        </TSDiv>
        <MarkdownRenderer content={SAMPLE_MD} className="mt-3 prose prose-sm dark:prose-invert max-w-none" />
      </TSDiv>
      <TSDiv className="p-4 text-sm text-[var(--text-secondary)] border-b border-[var(--border)]">
        <TSDiv tag="p">
          Remote hook via WASM <code>renderHook</code>
          {' '}
          — host <code>{hookHost}</code> path <code>{hookPath}</code>
        </TSDiv>
      </TSDiv>
      <TSDiv className="flex-1 overflow-hidden">
        <HookRenderer
          host={hookHost}
          hookPath={hookPath}
        />
      </TSDiv>
    </TSDiv>
  )
}
