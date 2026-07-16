import { useEffect } from 'react'
import { applyHistoryPathToActiveTab } from '../navigation/siteNavigation'

/**
 * Keeps the active repo tab `path` in sync with browser history (back/forward and
 * legacy navigations that only touch the History API).
 */
export function SpaHistoryListener () {
  useEffect(() => {
    const syncFromHistory = () => {
      const st = window.history.state as { relayContentPath?: string } | null
      const path = st?.relayContentPath ?? window.location.pathname
      if (path) applyHistoryPathToActiveTab(path)
    }

    window.addEventListener('popstate', syncFromHistory)
    return () => window.removeEventListener('popstate', syncFromHistory)
  }, [])

  return null
}
