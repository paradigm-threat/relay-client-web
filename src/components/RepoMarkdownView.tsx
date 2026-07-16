'use client'

import React, { useCallback, useEffect } from 'react'
import { MarkdownRenderer, ensureRelayMarkdownWasm } from '../relayMarkdown'
import { useAppState } from '../state/store'
import { usePlugin } from '../plugins/PluginContext'
import { resolveRepoContentPath } from '../navigation/resolveRepoPath'

export interface RepoMarkdownViewProps {
  markdown: string
  sourcePath?: string
}

function isSpaNavigableHref (href: string): boolean {
  if (/^(mailto:|tel:|#)/i.test(href)) return false
  if (/^https?:\/\//i.test(href)) {
    try {
      return typeof window !== 'undefined' && new URL(href).origin === window.location.origin
    } catch {
      return false
    }
  }
  return true
}

export function RepoMarkdownView ({ markdown, sourcePath }: RepoMarkdownViewProps) {
  const { plugin } = usePlugin()
  const contentBase = useAppState((s) => {
    const id = s.activeTabId
    if (!id) return '/'
    const t = s.tabs.find((x) => x.id === id)
    return t?.path ?? '/'
  })

  useEffect(() => {
    ensureRelayMarkdownWasm()
  }, [])

  const onLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const a = e.currentTarget
      const href = a.getAttribute('href')
      if (!href || !isSpaNavigableHref(href)) return
      if (a.target && a.target !== '_self') return
      const ev = e.nativeEvent
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return
      e.preventDefault()
      const resolved = resolveRepoContentPath(href, contentBase)
      if (plugin.navigate) plugin.navigate(resolved)
      else {
        window.history.pushState({}, '', resolved)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    },
    [contentBase, plugin],
  )

  return (
    <MarkdownRenderer
      content={markdown}
      sourcePath={sourcePath}
      className="prose prose-slate dark:prose-invert max-w-none p-4"
      anchorOnClick={onLinkClick}
    />
  )
}
