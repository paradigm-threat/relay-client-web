#!/usr/bin/env bash
# Build relay-runtime WASM into src/wasm/relay_runtime_pkg.
# FORCE_WASM=1 rebuilds when sibling relay-runtime is present (Vercel / local).
# Falls back to an existing package when the sibling crate is not checked out.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/src/wasm/relay_runtime_pkg"
GLUE="${OUT}/relay_runtime.js"
WASM="${OUT}/relay_runtime_bg.wasm"
SCRIPT="${ROOT}/../relay-runtime/scripts/build-wasm-web.sh"
HAVE_PKG=0
if [[ -f "$GLUE" && -f "$WASM" ]]; then
  HAVE_PKG=1
fi

if [[ "${FORCE_WASM:-}" == "1" && -f "$SCRIPT" ]]; then
  bash "$SCRIPT"
  exit 0
fi

if [[ "$HAVE_PKG" -eq 1 ]]; then
  if [[ "${FORCE_WASM:-}" == "1" ]]; then
    echo "[build:wasm] FORCE_WASM=1 but sibling relay-runtime missing; using existing package at $OUT"
  else
    echo "[build:wasm] Using existing package at $OUT (set FORCE_WASM=1 to rebuild)"
  fi
  exit 0
fi

if [[ ! -f "$SCRIPT" ]]; then
  echo "[build:wasm] Missing $SCRIPT and no committed WASM at $OUT" >&2
  echo "  Clone relay-runtime as a sibling, or commit src/wasm/relay_runtime_pkg/." >&2
  exit 1
fi

bash "$SCRIPT"
