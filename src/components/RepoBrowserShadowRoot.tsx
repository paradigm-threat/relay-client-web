import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAppState } from '../state/store'
import { ensureShadowStylesMirrored } from './repoBrowserShadowStyles'

type RepoBrowserShadowRootProps = {
  children: ReactNode
}

/**
 * Default host for repo tabs: open shadow root + mirrored document styles so hook UI is encapsulated from shell chrome.
 */
export function RepoBrowserShadowRoot ({ children }: RepoBrowserShadowRootProps) {
  const [mountPoint, setMountPoint] = useState<Element | ShadowRoot | null>(null)

  const setHostRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      setMountPoint(null)
      return
    }
    const attach =
      typeof el.attachShadow === 'function'
        ? () => {
          const sr = el.shadowRoot ?? el.attachShadow({ mode: 'open' })
          ensureShadowStylesMirrored(sr)
          return sr
        }
        : () => el

    try {
      setMountPoint(attach())
    } catch {
      setMountPoint(el)
    }
  }, [])

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
