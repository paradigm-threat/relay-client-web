import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAppState } from '../state/store'

type RepoBrowserShadowRootProps = {
  children: ReactNode
  /** When false, render as a normal element so the site can own document theme CSS. */
  encapsulate?: boolean
}

/**
 * In-app repo tabs: open shadow root so the site's injected CSS does not restyle shell chrome.
 * Fullscreen site-view skips the shadow so theme.yaml / html.light behave like a parked page.
 */
export function RepoBrowserShadowRoot ({ children, encapsulate = true }: RepoBrowserShadowRootProps) {
  const [mountPoint, setMountPoint] = useState<Element | ShadowRoot | null>(null)

  const setHostRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      setMountPoint(null)
      return
    }
    try {
      const sr = el.shadowRoot ?? el.attachShadow({ mode: 'open' })
      setMountPoint(sr)
    } catch {
      setMountPoint(el)
    }
  }, [])

  if (!encapsulate) {
    return (
      <div className="relay-repo-browser-host flex flex-col flex-1 min-h-0 min-w-0 h-full w-full">
        <RepoBrowserHookSurface>{children}</RepoBrowserHookSurface>
      </div>
    )
  }

  return (
    <div
      ref={setHostRef}
      className="relay-repo-browser-host flex flex-col flex-1 min-h-0 min-w-0 h-full w-full"
      data-relay-shadow-host=""
    >
      {mountPoint ? createPortal(<RepoBrowserHookSurface>{children}</RepoBrowserHookSurface>, mountPoint) : null}
    </div>
  )
}

function RepoBrowserHookSurface ({ children }: { children: ReactNode }) {
  const hookTheme = useAppState((s) => s.hookTheme)
  return (
    <div
      data-relay-theme-scope="hook"
      data-theme={hookTheme}
      className="relay-hook-surface flex flex-col h-full min-h-0 w-full theme"
    >
      {children}
    </div>
  )
}
