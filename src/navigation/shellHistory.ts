/**
 * Client-shell history: tab switches and site-view (chrome-less) live in the
 * History API as query params on `/` so Vercel filesystem 404s stay intact.
 *
 *   /                    home
 *   /?t=settings         settings tab
 *   /?repo=files         repo tab (host optional; re-picked from mirrors on refresh)
 *   /?view=files         fullscreen site (same WASM document; Back restores chrome)
 *   /?site=https://…     pasted origin with a client hook
 */

export type ShellLocation =
  | { kind: 'home' }
  | { kind: 'settings' }
  | { kind: 'test' }
  | { kind: 'repo'; repo: string; host?: string; path?: string }
  | { kind: 'site'; host: string; path?: string }
  | { kind: 'view'; repo?: string; host?: string; path?: string }

export function parseShellLocation (search: string = typeof window !== 'undefined' ? window.location.search : ''): ShellLocation {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const path = q.get('p') || undefined
  const view = q.get('view')
  const repo = q.get('repo')
  const site = q.get('site')
  const host = q.get('host') || site || undefined
  const t = q.get('t')

  if (view && view !== '0' && view !== 'false') {
    const viewRepo = view === '1' ? repo || undefined : view
    return { kind: 'view', repo: viewRepo, host, path }
  }
  if (repo) return { kind: 'repo', repo, host, path }
  if (site) return { kind: 'site', host: site, path }
  if (t === 'settings') return { kind: 'settings' }
  if (t === 'test') return { kind: 'test' }
  return { kind: 'home' }
}

export function shellLocationSearch (loc: ShellLocation): string {
  const q = new URLSearchParams()
  switch (loc.kind) {
    case 'home':
      break
    case 'settings':
      q.set('t', 'settings')
      break
    case 'test':
      q.set('t', 'test')
      break
    case 'repo':
      q.set('repo', loc.repo)
      if (loc.host) q.set('host', loc.host)
      if (loc.path && loc.path !== '/') q.set('p', loc.path)
      break
    case 'site':
      q.set('site', loc.host)
      if (loc.path && loc.path !== '/') q.set('p', loc.path)
      break
    case 'view':
      q.set('view', loc.repo || '1')
      if (loc.host) q.set('host', loc.host)
      if (loc.path && loc.path !== '/') q.set('p', loc.path)
      break
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export function shellLocationHref (loc: ShellLocation): string {
  return `/${shellLocationSearch(loc)}`
}

function writeHistory (loc: ShellLocation, method: 'pushState' | 'replaceState'): void {
  if (typeof window === 'undefined') return
  const href = shellLocationHref(loc)
  const state = { relayShell: loc }
  window.history[method](state, '', href)
}

export function pushShellLocation (loc: ShellLocation): void {
  writeHistory(loc, 'pushState')
}

export function replaceShellLocation (loc: ShellLocation): void {
  writeHistory(loc, 'replaceState')
}

export function locationFromTab (tab: {
  id: string
  host?: string
  repo?: string
  path?: string
  unsupported?: boolean
}): ShellLocation {
  if (tab.id === 'home') return { kind: 'home' }
  if (tab.id === 'settings') return { kind: 'settings' }
  if (tab.id === 'test') return { kind: 'test' }
  if (tab.repo) {
    return { kind: 'repo', repo: tab.repo, host: tab.host, path: tab.path }
  }
  if (tab.host) {
    return { kind: 'site', host: tab.host, path: tab.path }
  }
  return { kind: 'home' }
}

export function viewLocationFromTab (tab: {
  host?: string
  repo?: string
  path?: string
}): ShellLocation {
  return {
    kind: 'view',
    repo: tab.repo,
    host: tab.host,
    path: tab.path,
  }
}

export function isSiteView (loc: ShellLocation = parseShellLocation()): boolean {
  return loc.kind === 'view'
}
