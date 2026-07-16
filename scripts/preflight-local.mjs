#!/usr/bin/env node
/**
 * Local smoke checks before manual QA (WASM glue, optional tools).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const wasmGlue = path.join(root, 'src/wasm/relay_runtime_pkg/relay_runtime.js')
const strict = process.env.PREFLIGHT_STRICT === '1'

let failed = false

if (!fs.existsSync(wasmGlue)) {
  console.warn('[preflight] Missing relay-runtime WASM bundle:', wasmGlue)
  console.warn('  Run from relay-client-web: npm run build:wasm')
  failed = true
} else {
  console.log('[preflight] WASM bundle present:', wasmGlue)
}

if (fs.existsSync(path.join(root, '.env'))) {
  console.log('[preflight] .env found (RELAY_PUBLIC_* will be injected at build/dev)')
} else {
  console.log('[preflight] No .env (optional — see .env.example)')
}

if (fs.existsSync(path.join(root, '.env.local'))) {
  console.log('[preflight] .env.local found (overrides .env for RELAY_PUBLIC_*)')
}

if (failed && strict) {
  process.exit(1)
}
process.exit(0)
