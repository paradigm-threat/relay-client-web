/**
 * CSR iframe mount helpers: parked-origin <base href> and host boot overlay.
 * Theme CSS / html.dark live in the iframe document (see relay-runtime-web styleParentFor).
 */

const HTTP_PROTO = /^(https?:)/i

/** Trailing-slash base so root-relative `/site/header.png` hits the parked origin, not the SPA. */
export function parkedSiteBaseHref (host: string): string | null {
  const raw = String(host || '').trim()
  if (!raw) return null
  try {
    const withProto = HTTP_PROTO.test(raw) ? raw : `https://${raw}`
    const u = new URL(withProto)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const path = u.pathname.replace(/\/+$/, '')
    return `${u.origin}${path}/`
  } catch {
    return null
  }
}

/** Insert or update `<base href>` on an about:blank iframe document. */
export function ensureIframeDocumentBase (doc: Document, host: string): HTMLBaseElement | null {
  const href = parkedSiteBaseHref(host)
  if (!href || !doc.head) return null
  let baseEl = doc.querySelector('base')
  if (!baseEl) {
    baseEl = doc.createElement('base')
    doc.head.appendChild(baseEl)
  }
  baseEl.setAttribute('href', href)
  return baseEl
}

/**
 * Host overlay covers empty about:blank while WASM fetches.
 * Explicit hydrate must not cover existing SSR HTML (parked / embed).
 */
export function csrHostBootOverlayEnabled (mode: 'auto' | 'csr' | 'hydrate' | undefined): boolean {
  return mode !== 'hydrate'
}
