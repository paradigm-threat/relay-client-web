/**
 * WASM hook renderer inside a same-origin iframe so client chrome CSS / html.dark
 * cannot restyle the site. WASM still runs in the parent (init once).
 */
import { useEffect, useRef, useState } from 'react'

export interface ThemedHookRendererProps {
  host: string
  hookPath?: string
  initialPath?: string
  /** CSR for relay-client shell tabs; auto for direct hook URLs with SSR markup */
  mode?: 'auto' | 'csr' | 'hydrate'
}

export default function ThemedHookRenderer ({
  host,
  hookPath = '/hooks/client/get.jsx',
  initialPath = '/',
  mode = 'auto',
}: ThemedHookRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !host) {
      return
    }

    let cancelled = false
    setError(null)

    const boot = async () => {
      const doc = iframe.contentDocument
      if (!doc || cancelled) return
      doc.documentElement.style.height = '100%'
      doc.body.style.margin = '0'
      doc.body.style.minHeight = '100%'
      doc.body.style.height = '100%'
      doc.body.style.background = 'transparent'
      let mount = doc.getElementById('relay-hook-mount') as HTMLDivElement | null
      if (!mount) {
        mount = doc.createElement('div')
        mount.id = 'relay-hook-mount'
        mount.style.height = '100%'
        mount.style.minHeight = '100%'
        doc.body.appendChild(mount)
      } else {
        mount.innerHTML = ''
      }
      try {
        const { mountRelayHookIntoElement } = await import('../services/renderRelayHook.ts')
        if (cancelled) return
        await mountRelayHookIntoElement(mount, {
          host,
          hookPath,
          initialPath,
          mode,
          hydrate: mode === 'hydrate',
        })
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        console.error('[ThemedHookRenderer]', msg, e)
      }
    }

    const onLoad = () => {
      void boot()
    }
    iframe.addEventListener('load', onLoad)
    if (iframe.contentDocument?.readyState === 'complete') {
      void boot()
    }

    return () => {
      cancelled = true
      iframe.removeEventListener('load', onLoad)
      const doc = iframe.contentDocument
      const mount = doc?.getElementById('relay-hook-mount')
      if (mount) mount.innerHTML = ''
    }
  }, [host, hookPath, initialPath, mode])

  return (
    <div
      data-testid="relay-hook-shell"
      className="flex flex-col flex-1 min-h-0 h-full w-full overflow-hidden"
    >
      {error && (
        <div className="p-4 text-sm border-b whitespace-pre-wrap break-words"
          style={{ color: 'var(--text-error)', borderColor: 'var(--border-error)', background: 'var(--bg-error)' }}
        >
          Hook error:
          {' '}
          {error}
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Relay hook"
        className="relay-hook-mount flex-1 min-h-0 min-w-0 h-full w-full border-0 bg-transparent"
      />
    </div>
  )
}
