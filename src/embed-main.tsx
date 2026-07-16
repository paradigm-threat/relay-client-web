/**
 * Second entry: minimal embed host (no Home / Settings / peer chrome).
 * Served as `/assets/embed.js` beside the full app bundle.
 *
 * When the gateway SSR'd the client GET hook into `#root[data-relay-ssr]`, hydrate that
 * markup with WASM. Otherwise mount the React EmbedApp shell (CSR fallback).
 */

import './assets/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import EmbedApp from './EmbedApp'
import { installShellThemeBridge } from './shellThemeBridgeSync'

installShellThemeBridge()

const rootEl = document.getElementById('root')
if (rootEl?.dataset?.relaySsr === '1') {
  void import('./services/renderRelayHook.ts')
    .then(({ hydrateEmbedRoot }) => hydrateEmbedRoot(rootEl))
    .catch(async (e) => {
      console.error('[embed] SSR hydrate failed', e)
      // SSR markup is still valid static content — keep it readable with an error
      // panel on top instead of wiping the page for the CSR shell.
      if (rootEl.childElementCount > 0) {
        const { renderHookErrorUI } = await import('./vendor/relay-runtime-web.js')
        renderHookErrorUI(rootEl, e, { keepContent: true, title: 'Hydration error' })
        return
      }
      delete rootEl.dataset.relaySsr
      createRoot(rootEl).render(
        <StrictMode>
          <EmbedApp />
        </StrictMode>,
      )
    })
} else if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <EmbedApp />
    </StrictMode>,
  )
}
