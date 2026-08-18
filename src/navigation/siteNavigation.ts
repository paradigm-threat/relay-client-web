import { useAppState } from '../state/store'
import { normalizeContentPath, resolveRepoContentPath } from './resolveRepoPath'
import {
  locationFromTab,
  pushShellLocation,
  replaceShellLocation,
  viewLocationFromTab,
  type ShellLocation,
} from './shellHistory'

const CORE_TAB_IDS = new Set(['home', 'settings', 'test'])

/**
 * Single entry point for in-app navigation: updates the active repo tab path and
 * syncs the History API without reloading the page or the WASM runtime.
 */
export function applySiteNavigation (rawPath: string, opts?: { replace?: boolean }): void {
  const { activeTabId, tabs, updateTab, siteView } = useAppState.getState()
  if (!activeTabId || CORE_TAB_IDS.has(activeTabId)) return

  const tab = tabs.find((t) => t.id === activeTabId)
  if (!tab) return

  const current = tab.path ?? '/'
  const resolved = resolveRepoContentPath(rawPath, current)

  updateTab(activeTabId, (t) => ({ ...t, path: resolved }))

  const loc = siteView
    ? viewLocationFromTab({ ...tab, path: resolved })
    : { ...locationFromTab({ ...tab, path: resolved }), path: resolved }
  if (opts?.replace) replaceShellLocation(loc)
  else pushShellLocation(loc)
}

/**
 * Apply path from the address bar / history state (e.g. browser back/forward).
 */
export function applyHistoryPathToActiveTab (path: string): void {
  const { activeTabId, updateTab } = useAppState.getState()
  if (!activeTabId || CORE_TAB_IDS.has(activeTabId)) return
  const resolved = normalizeContentPath(path)
  updateTab(activeTabId, (t) => ({ ...t, path: resolved }))
}

/**
 * Apply a parsed location to Zustand without writing history (popstate / first paint).
 */
export function applyShellLocationToStore (loc: ShellLocation): void {
  const { setSiteView, setActiveTab, openTab, tabs, updateTab } = useAppState.getState()
  setSiteView(loc.kind === 'view')

  if (loc.kind === 'home') {
    setActiveTab('home')
    return
  }
  if (loc.kind === 'settings') {
    setActiveTab('settings')
    return
  }
  if (loc.kind === 'test') {
    setActiveTab('test')
    return
  }

  const repo = loc.kind === 'view' || loc.kind === 'repo' ? loc.repo : undefined
  const host = loc.host
  const path = loc.path

  if (repo) {
    const existing = tabs.find((t) => t.repo === repo && !t.unsupported)
    if (existing) {
      setActiveTab(existing.id)
      updateTab(existing.id, (t) => ({
        ...t,
        path: path ?? t.path,
        host: host || t.host,
      }))
      return
    }
    if (host) {
      openTab(host, path || '/', { repo, title: repo })
    }
    return
  }

  if (host) {
    const existing = tabs.find((t) => t.host === host && !t.unsupported)
    if (existing) {
      setActiveTab(existing.id)
      if (path) updateTab(existing.id, (t) => ({ ...t, path }))
      return
    }
    openTab(host, path || '/', { title: host })
  }
}

