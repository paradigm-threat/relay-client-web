# Relay Peer Configuration

## Web Client Environment Variables

The web client automatically exposes public environment variables prefixed with `RELAY_PUBLIC_` via `import.meta.env`.

Home lists **repositories** from live master nodes (not a server picker). Default nodes match the gateway installer:

`dfw1.relaygateway.net`, `lon1.relaygateway.net`, `hkg1.relaygateway.net`.

Stale `localStorage` entries that only contain legacy hosts (`atlanta2`, `atlanta3`, `jp-osa`) are replaced by that live list.

### Configuration

Set the master peer list in `.env`:

```dotenv
# Semicolon-separated list of relay master nodes:
RELAY_PUBLIC_MASTER_PEER_LIST="https://dfw1.relaygateway.net;https://lon1.relaygateway.net;https://hkg1.relaygateway.net"
```

### Build-time Injection

When you build the project (`npm run build`), the esbuild configuration:
1. Reads the `.env` file
2. Extracts all `RELAY_PUBLIC_*` variables
3. Injects them into `import.meta.env` definitions in the bundle

```typescript
const peerList = import.meta.env.RELAY_PUBLIC_MASTER_PEER_LIST
// => "https://dfw1.relaygateway.net;https://lon1.relaygateway.net;https://hkg1.relaygateway.net"
```

### Build Process

- **Development server** (`npm run dev`): Runs esbuild with a local server
- **Production build** (`npm run build`): Uses esbuild to bundle; reads .env and injects public vars

### Usage in PeersView

[`src/components/PeersView.tsx`](src/components/PeersView.tsx) resolves nodes with:

1. `localStorage['relay_peers']` after legacy migration
2. `import.meta.env.RELAY_PUBLIC_MASTER_PEER_LIST` (build-time env)
3. Built-in live fleet defaults

Each node is probed with **`POST /api/status?format=json`**. **Open →** loads `https://{repo}.{node}/` in the WASM client-hook renderer.

Pasted non-node URLs are opened only if `GET /hooks/client/get.jsx` returns 200; otherwise the tab says **Not supported**.

## Testing

Build and check that the live fleet is in the bundle:

```bash
npm run build
grep "dfw1.relaygateway" dist/assets/main.js  # Should find the URLs
```
