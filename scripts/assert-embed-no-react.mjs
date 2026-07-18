#!/usr/bin/env node
/**
 * Fail if the embed entry (and its imported chunks) contain React / ReactDOM.
 * Walks static and dynamic imports from dist/assets/embed.js (./relative and /assets/…).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = path.join(root, 'dist', 'assets')
const entry = path.join(assetsDir, 'embed.js')

const FORBIDDEN = [
  /node_modules\/react\//,
  /node_modules\/react-dom\//,
  /react\.development\.js/,
  /react-dom\.development\.js/,
  /react\.production/,
  /react-dom\.production/,
  /from ["']react["']/,
  /from ["']react-dom/,
  /from ["']react\/jsx-runtime["']/,
  /\bcreateRoot\s*\(/,
]

function resolveImport (fromFile, spec) {
  if (spec.startsWith('/assets/')) {
    return path.normalize(path.join(root, 'dist', spec.slice(1)))
  }
  if (spec.startsWith('./') || spec.startsWith('../')) {
    return path.normalize(path.join(path.dirname(fromFile), spec))
  }
  return null
}

function collectModules (startFile) {
  const seen = new Set()
  const queue = [startFile]
  const importRe =
    /(?:from|import)\s*\(\s*["']([^"']+)["']\s*\)|from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g
  while (queue.length) {
    const file = queue.shift()
    if (seen.has(file)) continue
    if (!fs.existsSync(file)) {
      throw new Error(`[assert-embed-no-react] missing module: ${file}`)
    }
    seen.add(file)
    const text = fs.readFileSync(file, 'utf8')
    for (const m of text.matchAll(importRe)) {
      const spec = m[1] || m[2] || m[3]
      if (!spec) continue
      const next = resolveImport(file, spec)
      if (!next) continue
      if (!next.startsWith(assetsDir)) continue
      if (!seen.has(next)) queue.push(next)
    }
  }
  return seen
}

if (!fs.existsSync(entry)) {
  console.error('[assert-embed-no-react] missing', entry, '— run npm run build first')
  process.exit(1)
}

const modules = collectModules(entry)
let failed = false
for (const file of modules) {
  const text = fs.readFileSync(file, 'utf8')
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      console.error(`[assert-embed-no-react] ${path.relative(root, file)} matches ${re}`)
      failed = true
    }
  }
}

if (failed) {
  console.error(
    '[assert-embed-no-react] modules walked:\n',
    [...modules].map((f) => '  ' + path.relative(root, f)).join('\n'),
  )
  process.exit(1)
}

console.log(
  `[assert-embed-no-react] ok — ${modules.size} module(s) under embed.js have no React`,
)
