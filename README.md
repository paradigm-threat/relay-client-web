# <img src="public/icon.png" width="32" height="32" align="center" /> Relay Client Web (React + TypeScript)

**HTTP protocol (planned change):** **`X-Relay-Branch`** will be **removed** — encode repo/branch only via **`Host`** (`{repo}.{node}` or `{repo}{DELIM}{branch-slug}.{node}`). See **[`../relay-server/docs/DEPLOY_WEB_AND_CI.md`](../relay-server/docs/DEPLOY_WEB_AND_CI.md)** §8, §11. Until then, `src/plugins/web/index.ts` may still set legacy headers; track removal with relay-server.

## Universal Relay shell (WASM + md2jsx)

1. **`npm run build:wasm`** — builds `relay-runtime` with **wasm-pack** into `src/wasm/relay_runtime_pkg/` (gitignored; run after cloning).
2. **`npm run build`** — bundles the app and copies the WASM pkg to `dist/wasm/relay_runtime_pkg/`.
3. **`RELAY_PUBLIC_FILES_BASE`** in `.env` (see `.env.example`) sets the default **files mirror** for `fetchContent`.

Design docs: **[`../relay-gateway/docs/RELAY_CLIENT_WEB_SHELL.md`](../relay-gateway/docs/RELAY_CLIENT_WEB_SHELL.md)**.

**Embed / full-page hook (no default chrome):** server may intercept GETs and return **HTML** that loads a **minimal** client bundle with a **preset** gateway and full-viewport **`hooks/client/get.jsx`** — see **[`../relay-gateway/docs/RELAY_EMBED_CLIENT_GET_INTERCEPT.md`](../relay-gateway/docs/RELAY_EMBED_CLIENT_GET_INTERCEPT.md)**.

### Local verification (pre-manual QA)

One command before testing in the browser:

- **`npm run verify:local`** — **`preflight`** (WASM glue present), **`eslint`**, **`typecheck`**, **`npm test`**, **`npm run build`**.
- **`PREFLIGHT_STRICT=1 npm run preflight`** — exits non-zero if `src/wasm/relay_runtime_pkg/` is missing (run **`npm run build:wasm`** first).
- Serve static **`dist/`** through relay-server: **`npm run serve:relay`** — uses **`RELAY_SERVER_BIN`** (default `relay-server`), **`RELAY_REPO_ROOT`**, **`RELAY_STATIC_PORT`** (default `8080`).

Then open **`http://127.0.0.1:5173`** with **`npm run dev`**, or run browser tests:

### Playwright (remote relay + WASM smoke)

- **`npx playwright install chromium`** once (browser binaries).
- **`npm run test:e2e`** — starts **`npm run dev`**, runs **`e2e/relay-remote.spec.ts`**: home peer list, optional **remote relay open-tab** flow when a master is **Online**, and **Test** tab **`markdown_to_ast_json`** visibility.
- **`E2E_RELAY_HOST`** — substring for which peer row to use (default: `node-dfw1.relaynet.online`).
- **`PW_NO_SERVER=1`** — use an already-running dev server; set **`PLAYWRIGHT_BASE_URL`** if not `http://127.0.0.1:5173`.

**Parity note:** repo tabs still use **`ThemedHookRenderer` stub** until CleverScript hook VDOM is fully wired; **server discovery** is fixed: **`OPTIONS /`** must return repos, and the client and gateway default the GET hook to **`hooks/client/get.jsx`** (`/hooks/client/get.jsx`). Repo hooks should import **`MarkdownRenderer`** from **`@clevertree/markdown`** (maps to the host shim over **relay-runtime** md2jsx WASM). Full multi-file browsing like the public Paradigm Threat site follows that work. WASM markdown parsing is validated on the **Test** tab.

This template provides a minimal setup to get React working in esbuild with some ESLint rules.

Currently, two official plugins are available:

- [esbuild](https://esbuild.github.io/) for fast builds and bundling

## Hook Component Naming Convention

To distinguish between precompiled JSX components and runtime-transpiled hook components:

- **Lowercase filenames** (`app.jsx`, `home.jsx`, `errorBoundary.jsx`): Runtime-transpiled hook components that are loaded dynamically
- **PascalCase filenames** (`App.jsx`, `Home.jsx`): Precompiled JSX components (not used in this project, but useful when integrating with other frameworks)

All client hook components in `public/hooks/` should use **lowercase** filenames to maintain consistency with dynamic loading patterns.

## Lazy Loading Hook Components

Hook components support React's lazy loading and error boundaries for code splitting:

```jsx
import React, { useState, useEffect, lazy, Suspense } from 'react'
import errorBoundary from './errorBoundary.jsx'

// Lazy load page components using dynamic import()
const Home = lazy(() => import('./home.jsx'))
const Settings = lazy(() => import('./settings.jsx'))
const Test = lazy(() => import('./test.jsx'))

export default function App() {
  return (
    <errorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        <Home />
      </Suspense>
    </errorBoundary>
  )
}
```

**How it works:**
- Dynamic `import('./module.jsx')` calls are automatically rewritten by hook-transpiler to `__hook_import('./module.jsx')`
- `__hook_import` is a runtime function that loads modules relative to the current hook's path
- `Suspense` wraps lazy components to display a loading fallback while the module loads
- `ErrorBoundary` catches any errors during component rendering or loading

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
