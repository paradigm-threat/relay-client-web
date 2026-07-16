/**
 * WASM-driven hook renderer: fetch remote/l sources, `run_hook_with_host`, VDOM → DOM
 * via vendored `relay-runtime-web` (`renderHook`).
 */
import { useEffect, useRef, useState } from 'react'

export interface ThemedHookRendererProps {
  host: string
  hookPath?: string
}

export default function ThemedHookRenderer ({
  host,
  hookPath = '/hooks/client/get.jsx',
}: ThemedHookRendererProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const el = mountRef.current
    if (!el || !host) {
      setLoading(false)
      return
    }

    let cancelled = false
    setError(null)
    setLoading(true)

    ;(async () => {
      try {
        const hasSsr = el.dataset?.relaySsr === '1' || el.querySelector?.('[data-relay-ssr]') != null
        if (!hasSsr) {
          el.innerHTML = ''
        }
        const { mountRelayHookIntoElement } = await import('../services/renderRelayHook.ts')
        if (cancelled) return
        await mountRelayHookIntoElement(el, { host, hookPath, hydrate: hasSsr })
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        console.error('[ThemedHookRenderer]', msg, e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      el.innerHTML = ''
    }
  }, [host, hookPath])

  return (
    <div
      data-testid="relay-hook-shell"
      className="flex flex-col flex-1 min-h-0 h-full w-full overflow-hidden"
    >
      {loading && (
        <div className="p-3 text-sm text-[var(--text-secondary)]">
          Loading hook…
        </div>
      )}
      {error && (
        <div className="p-4 text-red-700 text-sm border-b border-red-200 whitespace-pre-wrap break-words">
          Hook error:
          {' '}
          {error}
        </div>
      )}
      <div ref={mountRef} className="relay-hook-mount flex-1 min-h-0 min-w-0 h-full" />
    </div>
  )
}
