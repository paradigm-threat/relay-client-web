# <img src="public/icon.png" width="32" height="32" align="center" /> Relay Client Web (React + TypeScript)

**HTTP protocol (planned change):** **`X-Relay-Branch`** will be **removed** — encode repo/branch only via **`Host`** (`{repo}.{node}` or `{repo}{DELIM}{branch-slug}.{node}`). See **[`../relay-gateway/docs/DEPLOY_WEB_AND_CI.md`](../relay-gateway/docs/DEPLOY_WEB_AND_CI.md)** §8, §11. Until then, `src/plugins/web/index.ts` may still set legacy headers; track removal with the gateway.

## Universal Relay shell (WASM + md2ast)

1. **`npm run build:wasm`** — builds `relay-runtime` with **wasm-pack** into `src/wasm/relay_runtime_pkg/` (gitignored; run after cloning).
2. **`npm run build`** — bundles the app and copies the WASM pkg to `dist/wasm/relay_runtime_pkg/`.
3. **`RELAY_PUBLIC_FILES_BASE`** in `.env` or **`.env.local`** (see `.env.example`) sets the default **files mirror** for `fetchContent`. Local overrides: **`.env.local`** wins over **`.env`** for `RELAY_PUBLIC_*` injection at dev/build.

**Open repo:** Home **Open →** opens an in-app tab and pushes history (`/?repo=…`). Host is `{repo}.{node}` picked from live peers (lowest-latency healthy mirror, rotating among close ones). Tab switches push history; the tab **fullscreen** control hides chrome (`/?view=…`) so Back returns to the client. Sites render via **WASM CSR** in an isolated iframe (`ThemedHookRenderer` → `renderHook` with `mode: csr`) — not a nested HTML document fetch. Theme CSS and `html.dark` apply inside the iframe; `<base href>` points root-relative assets at the parked origin; a host loading overlay covers empty `about:blank` until WASM paints. See [`../relay-gateway/docs/RELAY_CLIENT_WEB_SHELL.md`](../relay-gateway/docs/RELAY_CLIENT_WEB_SHELL.md). Query params stay on `/` so Vercel filesystem 404s are unchanged. Chrome appearance is **System / Light / Dark** (same class-flip contract as parked sites).

**Preset remote hook (main bundle, fullscreen):** set **`RELAY_PUBLIC_PRESET_REMOTE_HOOK`** to a **base URL** (e.g. `http://localhost:3011`). The app skips the tabbed shell and loads **`/hooks/client/get.jsx`** on that origin. Precedence: URL query **`?relay_preset_hook=`** → **`window.RELAY_PUBLIC_PRESET_REMOTE_HOOK`** → **`import.meta.env`** (from `.env` / `.env.local`). **Security:** this loads **remote executable hook code**; only use origins you trust (same caveat as opening a **direct hook** tab from Settings).

**Static files relays (no `OPTIONS /`):** when discovery fails or returns no repos, the client **falls back** to the default GET hook path (`hooks/client/get.jsx`) so a plain HTTP static mirror can still host hooks.

Design docs: **[`../relay-gateway/docs/RELAY_CLIENT_WEB_SHELL.md`](../relay-gateway/docs/RELAY_CLIENT_WEB_SHELL.md)**.

**Embed / full-page hook (no default chrome):** server may intercept GETs and return **HTML** that loads a **minimal** client bundle with a **preset** gateway and full-viewport **`hooks/client/get.jsx`** — see **[`../relay-gateway/docs/RELAY_EMBED_CLIENT_GET_INTERCEPT.md`](../relay-gateway/docs/RELAY_EMBED_CLIENT_GET_INTERCEPT.md)**. That **`embed.js`** entry is **WASM-only** (no npm React / ReactDOM); parked sites must not pull the `main.js` React SPA. CleverScript stays platform-agnostic (no direct `document` access); page scripts must not inspect WASM run-state — only the published glue API. If npm React is ever needed for a host feature, it belongs behind a **native component** boundary (deferred).

**CDN publish (planned cutover):** build locally, then **`../relay-gateway/scripts/publish-web-assets.sh`** into **`relay-web-assets`** (signed `release` tip, **embed+WASM only — no React**). Gateway HTML pins **`/assets/c/{oid}/…`**. See **[`../relay-gateway/docs/RELAY_WEB_ASSETS.md`](../relay-gateway/docs/RELAY_WEB_ASSETS.md)**. Until fleet catalogs that repo, pack may still ship `dist/` as `/opt/relay/www` for local fallback.

### Local verification (pre-manual QA)

One command before testing in the browser:

- **`npm run verify:local`** — **`preflight`** (WASM glue present), **`eslint`**, **`typecheck`**, **`npm test`**, **`npm run build`**.
- **`PREFLIGHT_STRICT=1 npm run preflight`** — exits non-zero if `src/wasm/relay_runtime_pkg/` is missing (run **`npm run build:wasm`** first).
- Serve static **`dist/`** through the gateway: **`npm run serve:relay`** — uses **`RELAY_SERVER_BIN`** (default `relay-gateway`), **`RELAY_REPO_ROOT`**, **`RELAY_STATIC_PORT`** (default `8080`).

Then open **`http://127.0.0.1:5173`** with **`npm run dev`**, or run browser tests:

### Playwright (remote relay + WASM smoke)

- **`npx playwright install chromium`** once (browser binaries).
- **`npm run test:e2e`** — starts **`npm run dev`**, runs **`e2e/relay-remote.spec.ts`**: home node + repo list, optional **open repo tab** when a master is reachable, **unsupported URL**, and **Test** tab **`markdown_to_ast_json`** visibility.
- **`E2E_RELAY_HOST`** — substring for which node card to use (default: `iad1.relaygateway.net`).
- **`E2E_RELAY_REPO`** — repository to Open (default: `paradigm-threat-files`).
- **`PW_NO_SERVER=1`** — use an already-running dev server; set **`PLAYWRIGHT_BASE_URL`** if not `http://127.0.0.1:5173`.
- **`npm run test:e2e:preset`** — fullscreen **preset remote hook** (`playwright-preset.config.ts` injects **`RELAY_PUBLIC_PRESET_REMOTE_HOOK`**, default **`http://127.0.0.1:3011`**). Set **`E2E_PRESET_HOOK_BASE`** or start a static files server on that port; skips if the hook URL is not reachable.
- **Chrome DevTools MCP (optional):** with preset env, open `/` and confirm a **GET** to `{base}/hooks/client/get.jsx`; check console for hard errors.

**Parity note:** repo tabs use **relay-runtime** `run_hook_with_host` + VDOM for hooks (see `ThemedHookRenderer`). When **`OPTIONS /`** is missing or unusable, the client **still** uses the default GET hook path **`hooks/client/get.jsx`**. Full gateways may return repo metadata via **`OPTIONS /`**. Repo hooks should import **`MarkdownRenderer`** from **`@clevertree/markdown`**: bundled path maps to **`relay-runtime` vm** WASM virtual module (same **`anchorProps` / `anchorOnClick`** semantics as the React shim; default link behavior follows **`href`**). WASM markdown parsing is validated on the **Test** tab.

This template provides a minimal setup to get React working in esbuild with some ESLint rules.

Currently, two official plugins are available:

- [esbuild](https://esbuild.github.io/) for fast builds and bundling

## fan-edits library UI (local smoke)

1. Build WASM: `npm run build:wasm`
2. Start gateway serving fan-edits checkout: `npm run serve:fan-edits` (port 3011)
3. Run e2e: `npm run test:e2e:fan-edits`

Or manual: `npm run dev` and open `/?relay_preset_hook=http://127.0.0.1:3011`

See [fan-edits/docs/RELAY_UI_TEST_PLAN.md](../fan-edits/docs/RELAY_UI_TEST_PLAN.md).

## Hook sources

Client hooks are **CleverScript** executed by **relay-runtime WASM**, not transpiled to JS. Demo hooks live in `public/hooks/` (lowercase filenames).

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
