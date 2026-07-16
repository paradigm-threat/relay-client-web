import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppState } from './state/store'
import { RepoBrowser } from './components/RepoBrowser'
import { PluginProvider } from './plugins/PluginContext'
import { createWebPlugin } from './plugins/web'
import { applySiteNavigation } from './navigation/siteNavigation'

/**
 * Minimal Relay shell for server-generated embed pages (see `relay-gateway` `embed_html`).
 */
export default function EmbedApp () {
  const initEmbedSession = useAppState((s) => s.initEmbedSession)
  const [started, setStarted] = useState(false)

  const onNavigate = useCallback((path: string, opts?: { replace?: boolean }) => {
    applySiteNavigation(path, opts)
  }, [])

  const webPlugin = useMemo(
    () =>
      createWebPlugin({
        baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
        onNavigate,
      }),
    [onNavigate]
  )

  useEffect(() => {
    const el = document.getElementById('relay-embed-config')
    const raw = el?.textContent?.trim()
    if (!raw) {
      console.error('[EmbedApp] missing or empty #relay-embed-config')
      return
    }
    try {
      const cfg = JSON.parse(raw) as {
        repo: string
        branch: string
        initialPath: string
        clientHookPath: string
      }
      initEmbedSession(cfg)
      // Bridge embed JSON → zustand; one-time mount path (embed entry only).
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional gate until session exists
      setStarted(true)
    } catch (e) {
      console.error('[EmbedApp] invalid embed JSON', e)
    }
  }, [initEmbedSession])

  if (!started) {
    return null
  }

  return (
    <PluginProvider plugin={webPlugin}>
      <div data-testid="relay-embed-app" className="flex flex-col h-full min-h-0 w-full">
        <RepoBrowser tabId="embed" />
      </div>
    </PluginProvider>
  )
}
