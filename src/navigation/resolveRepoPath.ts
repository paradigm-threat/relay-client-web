/**
 * Normalize repo content paths for in-app navigation (single-page, no full reload).
 */
export function normalizeContentPath (p: string): string {
  if (!p) return '/'
  let s = p.replace(/\/+/g, '/')
  if (!s.startsWith('/')) s = `/${s}`
  return s
}

/**
 * Resolve an anchor `href` against the current repo tab path (file or directory).
 * Handles absolute (/…), relative (./…, ../…), and same-origin http(s) URLs.
 */
export function resolveRepoContentPath (href: string, currentPath: string): string {
  const cur = normalizeContentPath(currentPath || '/')
  const h = href.trim()
  if (!h) return cur

  if (/^(mailto:|tel:|#)/i.test(h)) return cur

  if (h.startsWith('/')) {
    return normalizeContentPath(h)
  }

  if (/^https?:\/\//i.test(h)) {
    try {
      const u = new URL(h)
      if (typeof window !== 'undefined' && u.origin !== window.location.origin) {
        return cur
      }
      return normalizeContentPath(u.pathname + u.search)
    } catch {
      return cur
    }
  }

  try {
    const base = new URL(cur, 'http://relay.invalid/')
    const u = new URL(h, base)
    return normalizeContentPath(u.pathname + u.search)
  } catch {
    return cur
  }
}
