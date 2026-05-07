import React, { useCallback, useEffect, useState } from 'react'
import { parseMarkdownToAstJson } from '../services/relayRuntimeWasm'
import { useAppState } from '../state/store'
import { usePlugin } from '../plugins/PluginContext'
import { resolveRepoContentPath } from '../navigation/resolveRepoPath'
import type { MdNode } from '../markdown/mdAst'
import { renderMdAstNode } from '../markdown/mdAst'

export interface MarkdownAstPreviewProps {
  markdown: string
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

/** Renders markdown via relay-runtime WASM → md2jsx AST → lightweight React DOM. */
export function MarkdownAstPreview ({ markdown }: MarkdownAstPreviewProps) {
  const [nodes, setNodes] = useState<MdNode[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const { plugin } = usePlugin()
  const contentBase = useAppState((s) => {
    const id = s.activeTabId
    if (!id) return '/'
    const t = s.tabs.find((x) => x.id === id)
    return t?.path ?? '/'
  })

  const onPreviewClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href')
      if (!href) return
      if (!isSpaNavigableHref(href)) return
      if (a.target && a.target !== '_self') return
      const ev = e.nativeEvent as MouseEvent
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) {
        return
      }
      e.preventDefault()
      const resolved = resolveRepoContentPath(href, contentBase)
      if (plugin.navigate) {
        plugin.navigate(resolved)
      } else {
        window.history.pushState({}, '', resolved)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    },
    [contentBase, plugin]
  )

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const json = await parseMarkdownToAstJson(markdown)
        const parsed = JSON.parse(json) as MdNode[]
        if (!cancel) setNodes(parsed)
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancel = true
    }
  }, [markdown])

  if (err) {
    return <div className="text-red-600 p-4">Markdown WASM error: {err}</div>
  }
  if (!nodes) {
    return <div className="p-4 text-[var(--text-secondary)]">Loading markdown AST…</div>
  }

  return (
    <article
      className="prose prose-slate dark:prose-invert max-w-none p-4"
      onClick={onPreviewClick}
    >
      {nodes.map((n, i) => renderMdAstNode(n, i))}
    </article>
  )
}
