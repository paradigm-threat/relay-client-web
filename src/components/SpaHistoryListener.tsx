import { useEffect } from 'react'
import { applyShellLocationToStore } from '../navigation/siteNavigation'
import { parseShellLocation } from '../navigation/shellHistory'

/**
 * Tab switches and site-view are History API entries. Back/forward restore chrome + tab.
 */
export function SpaHistoryListener () {
  useEffect(() => {
    const syncFromHistory = () => {
      applyShellLocationToStore(parseShellLocation())
    }

    syncFromHistory()
    window.addEventListener('popstate', syncFromHistory)
    return () => window.removeEventListener('popstate', syncFromHistory)
  }, [])

  return null
}
