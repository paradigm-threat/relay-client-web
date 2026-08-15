#!/usr/bin/env node
/**
 * Serves `dist/` via relay-gateway (or compatible binary).
 * Env: RELAY_SERVER_BIN (default relay-gateway), RELAY_REPO_ROOT, RELAY_STATIC_PORT (default 8080)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
if (!fs.existsSync(dist)) {
  console.error('[serve-relay] dist/ missing — run npm run build first')
  process.exit(1)
}

const bin = process.env.RELAY_SERVER_BIN || 'relay-gateway'
const repoRoot = process.env.RELAY_REPO_ROOT || root
const port = process.env.RELAY_STATIC_PORT || '8080'

const child = spawn(bin, ['--repo-root', repoRoot, '--static-paths', dist, '--port', port], {
  stdio: 'inherit',
})
child.on('exit', (code) => process.exit(code ?? 1))
