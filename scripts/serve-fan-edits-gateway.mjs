#!/usr/bin/env node
/**
 * Sync fan-edits checkout → bare mirror and serve via relay-gateway for web e2e / preset hook.
 *
 * Env:
 *   FAN_EDITS_REPO     — git checkout (default ~/dev/fan-edits)
 *   RELAY_GATEWAY_BIN  — relay-gateway binary
 *   FAN_EDITS_GATEWAY_PORT — listen port (default 3011)
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const fanEdits =
  process.env.FAN_EDITS_REPO ||
  path.join(os.homedir(), 'dev', 'fan-edits')
const port = process.env.FAN_EDITS_GATEWAY_PORT || '3011'
const mirrorRoot = process.env.RELAY_DESKTOP_MIRROR_ROOT || path.join(os.homedir(), '.relay', 'desktop-repos')
const barePath = path.join(mirrorRoot, 'fan-edits.git')

const gatewayBin =
  process.env.RELAY_GATEWAY_BIN ||
  path.join(root, '..', 'relay-gateway', 'target', 'debug', 'relay-gateway')

if (!fs.existsSync(fanEdits)) {
  console.error(`[serve-fan-edits] checkout missing: ${fanEdits}`)
  process.exit(1)
}
if (!fs.existsSync(gatewayBin)) {
  console.error(`[serve-fan-edits] build relay-gateway: cd ${path.dirname(gatewayBin)}/.. && cargo build --bin relay-gateway`)
  process.exit(1)
}

fs.mkdirSync(mirrorRoot, { recursive: true })
if (!fs.existsSync(barePath)) {
  spawnSync('git', ['init', '--bare', barePath], { stdio: 'inherit' })
}

const push = spawnSync('git', ['push', '--force', barePath, 'HEAD:refs/heads/main'], {
  cwd: fanEdits,
  stdio: 'inherit',
})
if (push.status !== 0) {
  process.exit(push.status ?? 1)
}

const child = spawn(
  gatewayBin,
  ['serve', '--repo', mirrorRoot, '--bind', `127.0.0.1:${port}`],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      RELAY_PUBLIC_HOSTNAME: 'localhost',
      RELAY_DEFAULT_REPO: 'fan-edits',
      RELAY_DESKTOP_MODE: '1',
      RELAY_PUT_REQUIRES_PRECOMMIT: '1',
    },
  },
)

child.on('exit', (code) => process.exit(code ?? 1))
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
