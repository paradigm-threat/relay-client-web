#!/usr/bin/env bash
# Copy relay-runtime web wrappers into src/vendor (embed graph input).
# Keeps @relay/gallery (relay-gallery.js) next to relay-runtime-web.js so esbuild
# can resolve the relative import — missing gallery = blank park pages with
# unresolved <relay-image-gallery class="pt-gallery"> hosts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/../relay-runtime/js"
DST="${ROOT}/src/vendor"
test -f "$SRC/relay-runtime-web.js" || {
  echo "error: missing $SRC/relay-runtime-web.js" >&2
  exit 1
}
test -f "$SRC/relay-gallery.js" || {
  echo "error: missing $SRC/relay-gallery.js" >&2
  exit 1
}
mkdir -p "$DST"
cp -f "$SRC/relay-runtime-web.js" "$DST/relay-runtime-web.js"
cp -f "$SRC/relay-gallery.js" "$DST/relay-gallery.js"
cp -f "$SRC/relay-runtime-web.d.ts" "$DST/relay-runtime-web.d.ts" 2>/dev/null || true
echo "synced vendor from relay-runtime/js → src/vendor (runtime-web + gallery)"
