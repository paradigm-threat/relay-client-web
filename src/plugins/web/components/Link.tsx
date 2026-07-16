import type { LinkProps } from '../../types'
import { usePlugin } from '../../PluginContext'
import { useAppState } from '../../../state/store'
import { resolveRepoContentPath } from '../../../navigation/resolveRepoPath'

/**
 * Web Link Component
 *
 * Internal links use client-side navigation (active tab path + History API) so the
 * page and WASM runtime are not reloaded.
 */
export function Link({
  href,
  target,
  rel,
  children,
  className = '',
}: LinkProps) {
  const { plugin } = usePlugin()
  const contentBase = useAppState((s) => {
    const id = s.activeTabId
    if (!id) return '/'
    const t = s.tabs.find((x) => x.id === id)
    return t?.path ?? '/'
  })

  const isInternal =
    !/^(mailto:|tel:|#)/i.test(href) &&
    (!/^https?:\/\//i.test(href) ||
      (typeof window !== 'undefined' &&
        (() => {
          try {
            return new URL(href).origin === window.location.origin
          } catch {
            return false
          }
        })()))


  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isInternal && !target) {
      e.preventDefault()

      const resolvedPath = resolveRepoContentPath(href, contentBase)

      if (plugin.navigate) {
        plugin.navigate(resolvedPath)
      } else {
        window.history.pushState({}, '', resolvedPath)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    }
  }

  // Set appropriate rel for external links
  const linkRel = target === '_blank' 
    ? (rel || 'noopener noreferrer') 
    : rel

  return (
    <a
      href={href}
      target={target}
      rel={linkRel}
      onClick={handleClick}
      className={`plugin-link ${className}`}
    >
      {children}
    </a>
  )
}
