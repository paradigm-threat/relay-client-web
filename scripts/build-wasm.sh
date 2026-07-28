#!/usr/bin/env bash
# Build relay-runtime WASM into src/wasm/relay_runtime_pkg.
# Skips when the package is already present unless FORCE_WASM=1 (Vercel ships a committed copy).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/src/wasm/relay_runtime_pkg"
GLUE="${OUT}/relay_runtime.js"
WASM="${OUT}/relay_runtime_bg.wasm"

if [[ "${FORCE_WASM:-}" != "1" && -f "$GLUE" && -f "$WASM" ]]; then
  echo "[build:wasm] Using existing package at $OUT (set FORCE_WASM=1 to rebuild)"
  exit 0
fi

SCRIPT="${ROOT}/../relay-runtime/scripts/build-wasm-web.sh"
if [[ ! -f "$SCRIPT" ]]; then
  echo "[build:wasm] Missing $SCRIPT and no committed WASM at $OUT" >&2
  echo "  Clone relay-runtime as a sibling, or commit src/wasm/relay_runtime_pkg/." >&2
  exit 1
fi

bash "$SCRIPT"
