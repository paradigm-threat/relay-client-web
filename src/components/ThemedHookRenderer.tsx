/**
 * Placeholder for full CleverScript + relay-runtime WASM hook rendering.
 * RepoBrowser/TestTab depend on this module; replace with WASM-driven UI when host fetch + VDOM commit are wired.
 */
import { TSDiv } from './TSDiv'

export interface ThemedHookRendererProps {
  host: string
  hookPath?: string
}

export default function ThemedHookRenderer ({ host, hookPath = '/hooks/client/get.jsx' }: ThemedHookRendererProps) {
  return (
    <div data-testid="relay-hook-shell" className="p-4 text-sm text-[var(--text-secondary)] space-y-2">
      <TSDiv tag="p">
        <strong>Hook shell (stub):</strong> host <code>{host}</code> path <code>{hookPath}</code>
      </TSDiv>
      <TSDiv tag="p" className="text-xs">
        Full <code>run_hook_with_host</code> + VDOM application will replace this placeholder. Use the Test tab for relay-runtime + md2jsx smoke tests.
      </TSDiv>
    </div>
  )
}
