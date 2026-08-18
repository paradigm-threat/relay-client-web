/**
 * Keep `html.light` / `html.dark` in sync with chrome preference (parked-site contract).
 * Do not call setCurrentTheme for chrome — that would restyle isolated site documents.
 */
import { useAppState } from './state/store'
import {
  applyChromeAppearance,
  normalizeChromeThemePref,
  subscribePrefersColorScheme,
} from './theme/chromeAppearance'

let installed = false

export function installShellThemeBridge (): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  const sync = (): void => {
    const pref = normalizeChromeThemePref(useAppState.getState().shellTheme)
    applyChromeAppearance(pref)
  }

  sync()
  useAppState.subscribe((state, previousState) => {
    if (state.shellTheme !== previousState.shellTheme) {
      sync()
    }
  })
  subscribePrefersColorScheme(() => {
    if (normalizeChromeThemePref(useAppState.getState().shellTheme) === 'system') {
      sync()
    }
  })
}
