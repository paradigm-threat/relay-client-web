import React from 'react'
import type { ElementType } from 'react'

/** AST node shape from relay-runtime `markdown_to_ast_json`. */
export type MdNode =
  | { type: 'text'; content: string }
  | { type: 'element'; tag: string; props: Record<string, unknown>; children: MdNode[] }

export function renderMdAstNode (n: MdNode, i: number): React.ReactNode {
  if (n.type === 'text') {
    return <React.Fragment key={i}>{n.content}</React.Fragment>
  }
  const props = n.props || {}
  const reactProps: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className' && typeof v === 'string') reactProps.className = v
    else if (k === 'href' && typeof v === 'string') reactProps.href = v
    else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') reactProps[k] = v
  }
  const Tag = (n.tag || 'div') as ElementType
  const kids = (n.children || []).map((c, j) => renderMdAstNode(c, j))
  return React.createElement(Tag, { key: i, ...reactProps }, kids)
}
