/**
 * Native markdown UI for repo client hooks (`@clevertree/markdown` / `@clevertree/hook-transpiler`).
 * Renders via relay-runtime WASM (md2jsx AST) — same pipeline as `MarkdownAstPreview`, with
 * navigation delegated to the caller (`navigate` from hook context).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { parseMarkdownToAstJson } from '../services/relayRuntimeWasm'
import { resolveRepoContentPath } from '../navigation/resolveRepoPath'
import type { MdNode } from '../markdown/mdAst'
import { renderMdAstNode } from '../markdown/mdAst'

export interface MarkdownRendererProps {
  content: string
  navigate: (path: string) => void
  onElement?: (tag: string, props: Record<string, unknown>) => void
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

export function MarkdownRenderer ({ content, navigate, onElement: _onElement }: MarkdownRendererProps) {
  const [nodes, setNodes] = useState<MdNode[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const contentPath = useMemo(
    () => (typeof window !== 'undefined' ? window.location.pathname : '/'),
    [],
  )

  const onClick = useCallback(
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
      const resolved = resolveRepoContentPath(href, contentPath)
      navigate(resolved)
    },
    [contentPath, navigate],
  )

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const json = await parseMarkdownToAstJson(content)
        const parsed = JSON.parse(json) as MdNode[]
        if (!cancel) setNodes(parsed)
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancel = true
    }
  }, [content])

  if (err) {
    return <div className="text-red-600 p-4 text-sm">MarkdownRenderer: {err}</div>
  }
  if (!nodes) {
    return <div className="p-4 text-[var(--text-secondary)] text-sm">Loading markdown…</div>
  }

  return (
    <article
      className="prose prose-slate dark:prose-invert max-w-none p-4"
      onClick={onClick}
    >
      {nodes.map((n, i) => renderMdAstNode(n, i))}
    </article>
  )
}
