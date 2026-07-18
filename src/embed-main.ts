/**
 * Embed host for parked sites / ?embed=1 — WASM hydrate or CSR mount only.
 * Served as `/assets/embed.js`. No React / ReactDOM.
 */

import './assets/embed.css'
import { bootEmbedRoot } from './services/renderRelayHook.ts'

const rootEl = document.getElementById('root')
if (!rootEl) {
  console.error('[embed] missing #root')
} else {
  void bootEmbedRoot(rootEl).catch(async (e) => {
    console.error('[embed] boot failed', e)
    // SSR markup remains valid static content — keep it and show a light error panel.
    if (rootEl.dataset?.relaySsr === '1' && rootEl.childElementCount > 0) {
      const { renderHookErrorUI } = await import('./vendor/relay-runtime-web.js')
      renderHookErrorUI(rootEl, e, { keepContent: true, title: 'Hydration error' })
      return
    }
    const { renderHookErrorUI } = await import('./vendor/relay-runtime-web.js')
    renderHookErrorUI(rootEl, e, { keepContent: false, title: 'Embed error' })
  })
}
