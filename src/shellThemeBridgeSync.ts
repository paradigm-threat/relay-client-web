/**
 * Keeps document-level themed-styler shell theme in sync with Zustand (preset/embed bundles skip App.tsx).
 */
import { unifiedBridge } from '@clevertree/themed-styler'
import { useAppState } from './state/store'

let installed = false

export function installShellThemeBridge (): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  const sync = (): void => {
    try {
      const shellTheme = useAppState.getState().shellTheme
      if (unifiedBridge.setCurrentTheme) {
        unifiedBridge.setCurrentTheme(shellTheme)
      }
    } catch {
      /* noop */
    }
  }

  sync()
  useAppState.subscribe((state, previousState) => {
    if (state.shellTheme !== previousState.shellTheme) {
      sync()
    }
  })
}
