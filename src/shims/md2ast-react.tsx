/**
 * Standalone shim for `@clevertree/md2ast-react` so Vercel/CI can build without
 * the relay-gateway monorepo package. Renders markdown via relay-runtime WASM.
 */
import React, { useEffect, useState, type MouseEventHandler } from 'react'
import { parseMarkdownToAstJson } from '../services/relayRuntimeWasm'
import type { MdNode } from '../markdown/mdAst'
import { renderMdAstNode } from '../markdown/mdAst'

export interface MarkdownRendererProps {
  content: string
  sourcePath?: string
  className?: string
  anchorOnClick?: MouseEventHandler<HTMLAnchorElement>
}

/** No-op: markdown parsing uses relay-runtime WASM loaded by the client shell. */
export function configureMd2astWasm (_baseUrl?: string): void {}

export function MarkdownRenderer ({
  content,
  className,
  anchorOnClick,
}: MarkdownRendererProps) {
  const [nodes, setNodes] = useState<MdNode[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

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
      className={className ?? 'prose prose-slate dark:prose-invert max-w-none p-4'}
      onClick={(e) => {
        if (!anchorOnClick) return
        const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
        if (!a) return
        anchorOnClick(e as unknown as React.MouseEvent<HTMLAnchorElement>)
      }}
    >
      {nodes.map((n, i) => renderMdAstNode(n, i))}
    </article>
  )
}
