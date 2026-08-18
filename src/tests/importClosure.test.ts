import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  localImportSpecs,
  putModuleInMap,
  preloadImportClosure,
  resolveImportRel,
} from '../vendor/relay-runtime-web.js'

test('localImportSpecs finds local from-imports and skips packages', () => {
  const src = `
import React from 'react'
import StyleContext from '@clevertree/style'
import BootShell from 'hooks/client/components/BootShell.jsx'
import { propOr } from "hooks/client/propOr.jsx"
import Rel from './foo.jsx'
`
  assert.deepEqual(localImportSpecs(src), [
    'hooks/client/components/BootShell.jsx',
    'hooks/client/propOr.jsx',
    './foo.jsx',
  ])
})

test('resolveImportRel joins relative specs and keeps hooks/ absolute', () => {
  assert.equal(
    resolveImportRel('hooks/client/components/Nav.jsx', '../propOr.jsx'),
    'hooks/client/propOr.jsx',
  )
  assert.equal(
    resolveImportRel('hooks/client/get.jsx', 'hooks/client/components/BootShell.jsx'),
    'hooks/client/components/BootShell.jsx',
  )
})

test('preloadImportClosure BFS-fetches transitive modules like propOr.jsx', async () => {
  const files: Record<string, string> = {
    'hooks/client/get.jsx': `
import Layout from 'hooks/client/components/Layout.jsx'
export default function App() { return <Layout /> }
`,
    'hooks/client/components/Layout.jsx': `
import { propOr } from 'hooks/client/propOr.jsx'
export default function Layout(props) { return <div>{propOr(props, 'x', 'y')}</div> }
`,
    'hooks/client/propOr.jsx': `
export function propOr(props, key, fallback) { return fallback }
`,
  }
  const moduleMap: Record<string, string> = {}
  putModuleInMap(moduleMap, 'hooks/client/get.jsx', files['hooks/client/get.jsx'])
  const fetched: string[] = []
  await preloadImportClosure(moduleMap, async (rel) => {
    fetched.push(rel)
    return files[rel] ?? null
  })
  assert.ok(moduleMap['hooks/client/components/Layout.jsx'], 'Layout.jsx loaded')
  assert.ok(moduleMap['hooks/client/propOr.jsx'], 'propOr.jsx loaded via BFS')
  assert.ok(fetched.includes('hooks/client/components/Layout.jsx'))
  assert.ok(fetched.includes('hooks/client/propOr.jsx'))
})

test('preloadImportClosure skips HTML fallback bodies', async () => {
  const moduleMap: Record<string, string> = {}
  putModuleInMap(
    moduleMap,
    'hooks/client/get.jsx',
    `import Missing from 'hooks/client/missing.jsx'\nexport default function App() { return null }\n`,
  )
  await preloadImportClosure(moduleMap, async () => '<!DOCTYPE html><html><body>spa</body></html>')
  assert.equal(moduleMap['hooks/client/missing.jsx'], undefined)
})
