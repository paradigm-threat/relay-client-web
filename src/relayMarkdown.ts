'use client'

import { MarkdownRenderer, configureMd2astWasm } from '@clevertree/md2ast-react'

let configured = false

export function ensureRelayMarkdownWasm (): void {
  if (configured || typeof window === 'undefined') return
  configureMd2astWasm(`${window.location.origin}/wasm/md2ast/`)
  configured = true
}

export { MarkdownRenderer }
