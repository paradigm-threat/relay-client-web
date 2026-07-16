/**
 * Mirror document styles into a RepoBrowser ShadowRoot so Tailwind + injected styles apply inside the shadow tree.
 * Shadow DOM does not inherit author stylesheets from the document.
 */

const styledRoots = new WeakSet<ShadowRoot>()

function appendLinkClones(shadowRoot: ShadowRoot): HTMLLinkElement[] {
  const out: HTMLLinkElement[] = []
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach((node) => {
    const src = node as HTMLLinkElement
    const copy = document.createElement('link')
    copy.rel = 'stylesheet'
    copy.href = src.href
    if (src.media) copy.media = src.media
    copy.setAttribute('data-relay-shadow-clone', 'link')
    shadowRoot.appendChild(copy)
    out.push(copy)
  })
  return out
}

function appendStyleClones(shadowRoot: ShadowRoot): HTMLStyleElement[] {
  const out: HTMLStyleElement[] = []
  document.head.querySelectorAll('style').forEach((node) => {
    const src = node as HTMLStyleElement
    const copy = document.createElement('style')
    copy.textContent = src.textContent || ''
    copy.setAttribute('data-relay-shadow-clone', 'style')
    shadowRoot.appendChild(copy)
    out.push(copy)
  })
  return out
}

/** Idempotent: mirrors head styles once per ShadowRoot. */
export function ensureShadowStylesMirrored(shadowRoot: ShadowRoot): void {
  if (styledRoots.has(shadowRoot)) return
  styledRoots.add(shadowRoot)
  appendLinkClones(shadowRoot)
  appendStyleClones(shadowRoot)
}
