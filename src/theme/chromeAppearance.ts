/**
 * Client chrome appearance: light / dark / system, same contract as parked sites
 * (`html.light` / `html.dark`). Does not call setCurrentTheme — dual CSS + class flip.
 */

export type ChromeThemePref = 'system' | 'light' | 'dark'
export type ChromeScheme = 'light' | 'dark'

export function normalizeChromeThemePref (raw: string | null | undefined): ChromeThemePref {
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  if (raw === 'default') return 'system'
  return 'system'
}

export function resolveChromeScheme (pref: ChromeThemePref, prefersDark: boolean): ChromeScheme {
  if (pref === 'light' || pref === 'dark') return pref
  return prefersDark ? 'dark' : 'light'
}

export function readPrefersDark (media?: Pick<MediaQueryList, 'matches'> | null): boolean {
  if (media && typeof media.matches === 'boolean') return media.matches
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Flip `html.light` / `html.dark` for client chrome. Isolated site iframes keep their own document. */
export function applyChromeAppearance (
  pref: ChromeThemePref,
  root: HTMLElement | null = typeof document !== 'undefined' ? document.documentElement : null,
  prefersDark: boolean = readPrefersDark(),
): ChromeScheme {
  const scheme = resolveChromeScheme(pref, prefersDark)
  if (!root) return scheme
  root.classList.remove('light', 'dark')
  root.classList.add(scheme)
  root.setAttribute('data-relay-chrome-theme', pref)
  root.style.colorScheme = scheme
  return scheme
}

export function subscribePrefersColorScheme (onChange: (prefersDark: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (e: MediaQueryListEvent) => onChange(e.matches)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
