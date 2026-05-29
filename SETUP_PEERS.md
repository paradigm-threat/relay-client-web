# Relay Peer Configuration

## Web Client Environment Variables

The web client automatically exposes public environment variables prefixed with `RELAY_PUBLIC_` via `import.meta.env`.

### Configuration

Set the master peer list in `.env`:

```dotenv
# Semicolon-separated list of relay master peers (standard fleet defaults; same three as relay-gateway):
RELAY_PUBLIC_MASTER_PEER_LIST="https://atlanta2.relaygateway.net"
```

### Build-time Injection

When you build the project (`npm run build`), the esbuild configuration:
1. Reads the `.env` file
2. Extracts all `RELAY_PUBLIC_*` variables
3. Injects them into `import.meta.env` definitions in the bundle

When the default peer list in the bundle changes, clear **`localStorage`** for this origin (or remove **`relay_peers`**) so **`RELAY_PUBLIC_MASTER_PEER_LIST`** / the new built-in default applies.

```typescript
const peerList = import.meta.env.RELAY_PUBLIC_MASTER_PEER_LIST
// => "https://atlanta2.relaygateway.net"
```

### Build Process

- **Development server** (`npm run dev`): Runs esbuild with a local server
- **Production build** (`npm run build`): Uses esbuild to bundle; reads .env and injects public vars

### Usage in PeersView Component

The [src/components/PeersView.tsx](src/components/PeersView.tsx) component reads the peer list with fallback chain:

1. localStorage (user customizations)
2. `import.meta.env.RELAY_PUBLIC_MASTER_PEER_LIST` (build-time env)
3. Server config API
4. Localhost fallback

Example output:
```typescript
// From getPeersFromEnvironment() in PeersView.tsx
[
  "https://atlanta2.relaygateway.net"
]
```

## Testing

Build and check that peer list is in bundle:

```bash
npm run build
grep "atlanta2.relaygateway" dist/assets/main.js  # Should find the URLs
```
