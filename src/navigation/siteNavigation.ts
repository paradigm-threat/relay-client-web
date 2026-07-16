import { useAppState } from '../state/store'
import { normalizeContentPath, resolveRepoContentPath } from './resolveRepoPath'

const CORE_TAB_IDS = new Set(['home', 'settings', 'test'])

/**
 * Single entry point for in-app navigation: updates the active repo tab path and
 * syncs the History API without reloading the page or the WASM runtime.
 */
export function applySiteNavigation (rawPath: string, opts?: { replace?: boolean }): void {
  const { activeTabId, tabs, updateTab } = useAppState.getState()
  if (!activeTabId || CORE_TAB_IDS.has(activeTabId)) return

  const tab = tabs.find((t) => t.id === activeTabId)
  if (!tab) return

  const current = tab.path ?? '/'
  const resolved = resolveRepoContentPath(rawPath, current)

  updateTab(activeTabId, (t) => ({ ...t, path: resolved }))

  const method = opts?.replace ? 'replaceState' : 'pushState'
  const state = { relayContentPath: resolved }
  window.history[method](state, '', resolved)
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
