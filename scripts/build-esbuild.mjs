#!/usr/bin/env node
import { build, context } from 'esbuild'
import fs from 'fs'
import path from 'path'
import express from 'express'
import http from 'http'
import { createRequire } from 'node:module'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const root = path.resolve(path.join(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..'))
const srcDir = path.join(root, 'src')
const outDir = path.join(root, 'dist')
const assetsDir = path.join(outDir, 'assets')
const templateDir = path.resolve(path.join(root, '../relay/template'))

function copyPublic() {
  const publicDir = path.join(root, 'public')
  if (fs.existsSync(publicDir)) {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }
    const files = fs.readdirSync(publicDir)
    for (const file of files) {
      const src = path.join(publicDir, file)
      const dest = path.join(outDir, file)
      try {
        if (fs.lstatSync(src).isSymbolicLink()) {
          // Skip symbolic links that might point to missing targets
          continue
        }
        fs.cpSync(src, dest, { recursive: true, force: true, dereference: true })
      } catch (e) {
        console.warn(`[esbuild] Failed to copy ${src} to ${dest}: ${e.message}`)
      }
    }
  }
}

function copyHooksToTemplate() {
  const hooksDir = path.join(root, 'hooks')
  const hooksOut = path.join(templateDir, 'hooks')
  if (fs.existsSync(hooksDir)) {
    try {
      fs.cpSync(hooksDir, hooksOut, { recursive: true, force: true })
      console.log('[esbuild] Copied hooks directory to template/hooks')
    } catch (e) {
      console.warn(`[esbuild] Failed to copy hooks to template: ${e.message}`)
    }
  }
}

function copyHooksToDist() {
  const hooksDir = path.join(root, 'hooks')
  const hooksOut = path.join(outDir, 'hooks')
  if (fs.existsSync(hooksDir)) {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }
    try {
      fs.cpSync(hooksDir, hooksOut, { recursive: true, force: true })
      console.log('[esbuild] Copied hooks directory to dist/hooks')
    } catch (e) {
      console.warn(`[esbuild] Failed to copy hooks to dist: ${e.message}`)
    }
  }
}

function copyHooksToPublic() {
  const hooksDir = path.join(root, 'hooks')
  const publicDir = path.join(root, 'public')
  const hooksOut = path.join(publicDir, 'hooks')
  if (fs.existsSync(hooksDir)) {
    try {
      fs.cpSync(hooksDir, hooksOut, { recursive: true, force: true })
      console.log('[esbuild] Copied hooks directory to public/hooks')
    } catch (e) {
      console.warn(`[esbuild] Failed to copy hooks to public: ${e.message}`)
    }
  }
}

function copyWasmToAssets() {
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true })
  }

  const wasmPkg = path.join(srcDir, 'wasm', 'relay_runtime_pkg')
  if (fs.existsSync(wasmPkg)) {
    const outWasm = path.join(outDir, 'wasm', 'relay_runtime_pkg')
    fs.mkdirSync(outWasm, { recursive: true })
    fs.cpSync(wasmPkg, outWasm, { recursive: true, force: true })
    console.log('[esbuild] Copied relay_runtime_pkg (WASM) to dist/wasm/relay_runtime_pkg')
  } else {
    console.warn('[esbuild] relay_runtime_pkg missing — run: npm run build:wasm')
  }
}

// Read .env file and extract RELAY_PUBLIC_* variables
function readEnvFile(envPath) {
  const env = {}
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      // Expose RELAY_PUBLIC_* variables
      if (key.startsWith('RELAY_PUBLIC_')) {
        env[key] = val.replace(/^["|']|["|']$/g, '')
      }
    }
  }
  return env
}

export async function bundle({ serve = false } = {}) {
  if (!serve) {
    // Hashed split chunks change names; never package stale bundles from previous builds.
    fs.rmSync(outDir, { recursive: true, force: true })
  }
  const envVars = readEnvFile(path.join(root, '.env'))

  // Build define object for import.meta.env access
  const importMetaDefines = {}
  for (const [key, val] of Object.entries(envVars)) {
    importMetaDefines[`import.meta.env.${key}`] = JSON.stringify(val)
  }

  // Resolve React/ReactDOM from the app root to avoid duplicate copies
  const req = createRequire(import.meta.url)
  const reactEntry = req.resolve('react')
  const reactJsxRuntimeEntry = req.resolve('react/jsx-runtime')
  const reactDomEntry = req.resolve('react-dom')
  const reactDomClientEntry = req.resolve('react-dom/client')

  const tailwindConfigPath = path.join(root, 'tailwind.config.cjs')

  const opts = {
    entryPoints: {
      'main': path.join(srcDir, 'main.tsx'),
      // WASM-only parked-site / ?embed=1 bootloader (no React).
      'embed': path.join(srcDir, 'embed-main.ts'),
    },
    outdir: assetsDir,
    publicPath: './',
    bundle: true,
    format: 'esm',
    sourcemap: true,
    minify: false,
    target: ['es2020'],
    jsx: 'automatic',
    jsxImportSource: 'react',
    loader: {
      '.png': 'file',
      '.svg': 'file',
      '.css': 'css',
      '.wasm': 'file',
      '.yaml': 'text',
    },
    metafile: true,
    splitting: true,
    logLevel: 'info',
    external: ['android-ios-native'],
    define: {
      'process.env.NODE_ENV': '\"development\"',
      '__DEV__': 'true',
      ...importMetaDefines,
    },
    plugins: [
      {
        name: 'postcss-tailwind',
        setup(build) {
          build.onLoad({ filter: /[/\\]assets[/\\]index\.css$/ }, async (args) => {
            const source = await fs.promises.readFile(args.path, 'utf8')
            const result = await postcss([
              tailwindcss(tailwindConfigPath),
              autoprefixer,
            ]).process(source, { from: args.path })
            return { contents: result.css, loader: 'css' }
          })
        },
      },
      {
        name: 'alias-clevertree-shims',
        setup(build) {
          const themed = path.join(srcDir, 'shims', 'themed-styler.ts')
          const transpiler = path.join(srcDir, 'shims', 'hook-transpiler.tsx')
          const markdown = path.join(srcDir, 'shims', 'markdown.tsx')
          const md2astReactLocal = path.join(srcDir, 'shims', 'md2ast-react.tsx')
          const md2astReactMonorepo = path.resolve(root, '../relay-gateway/packages/md2ast-react/dist/index.js')
          const md2astReact = fs.existsSync(md2astReactMonorepo) ? md2astReactMonorepo : md2astReactLocal
          build.onResolve({ filter: /^@clevertree\/themed-styler$/ }, () => ({ path: themed }))
          build.onResolve({ filter: /^@clevertree\/hook-transpiler$/ }, () => ({ path: transpiler }))
          build.onResolve({ filter: /^@clevertree\/markdown$/ }, () => ({ path: markdown }))
          build.onResolve({ filter: /^@clevertree\/md2ast-react$/ }, () => ({ path: md2astReact }))
        }
      },
      // Force a single React instance across workspace packages
      {
        name: 'force-react-singleton',
        setup(build) {
          build.onResolve({ filter: /^(react|react\/jsx-runtime|react-dom|react-dom\/client)$/ }, args => {
            switch (args.path) {
              case 'react':
                return { path: reactEntry }
              case 'react/jsx-runtime':
                return { path: reactJsxRuntimeEntry }
              case 'react-dom':
                return { path: reactDomEntry }
              case 'react-dom/client':
                return { path: reactDomClientEntry }
            }
          })
        }
      },
      // Resolve absolute `/src/...` imports (used by shared wasmLoader shim) to this package's src directory
      {
        name: 'alias-src-root',
        setup(build) {
          build.onResolve({ filter: /^\/src\// }, args => {
            const rel = args.path.slice('/src/'.length)
            const target = path.join(srcDir, rel)
            // Prefer explicit .ts resolution for our source files
            const withTs = `${target}.ts`
            if (fs.existsSync(withTs)) return { path: withTs }
            if (fs.existsSync(target)) return { path: target }
            return { path: withTs }
          })
        }
      },
      {
        name: 'browser-external-node-module',
        setup(build) {
          build.onResolve({ filter: /^node:module$/ }, args => {
            return { path: args.path, namespace: 'browser-external' }
          })
          build.onLoad({ filter: /.*/, namespace: 'browser-external' }, () => {
            const code = `export function createRequire() { return function() { throw new Error('createRequire is not available in the browser'); }; }`
            return { contents: code, loader: 'js' }
          })
        }
      }
    ],
    // Use a stable entry name for predictable index.html
    entryNames: '[name]',
  }
  if (serve) {
    const appCTX = await context(opts)

    // Use Express to serve everything with proper MIME types on one port
    const app = express()

    // Middleware to set proper MIME types for .jsx, .ts, .tsx, .js files
    app.use((req, res, next) => {
      if (req.path.endsWith('.jsx')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
      } else if (req.path.endsWith('.ts') || req.path.endsWith('.tsx')) {
        res.setHeader('Content-Type', 'application/typescript; charset=utf-8')
      } else if (req.path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
      }
      next()
    })

    // Set CORS headers
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      res.header('Access-Control-Expose-Headers', 'X-Hook-Path')
      
      // Inject X-Hook-Path for discovery
      if (req.method === 'OPTIONS' || req.path === '/') {
        res.header('X-Hook-Path', '/hooks/client/get.jsx')
      }

      if (req.method === 'OPTIONS') {
        res.sendStatus(204)
        return
      }
      next()
    })

    // Serve /hooks/* from relay-template/hooks/ 
    const templateHooksDir = path.join(root, '..', 'relay-template', 'hooks')
    if (fs.existsSync(templateHooksDir)) {
      app.use('/hooks', express.static(templateHooksDir, {
        dotfiles: 'allow'
      }))
      console.log('[esbuild] Serving /hooks/* from relay-template/hooks/')
    } else {
      // Fallback to local public/hooks
      const publicHooksDir = path.join(root, 'public', 'hooks')
      if (fs.existsSync(publicHooksDir)) {
        app.use('/hooks', express.static(publicHooksDir, {
          dotfiles: 'allow'
        }))
        console.log('[esbuild] Serving /hooks/* from public/hooks/ (live)')
      }
    }

    // Serve the main app from dist/ 
    app.use(express.static(outDir, {
      index: 'index.html',
      dotfiles: 'allow'
    }))

    // Fallback to index.html for SPA routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(outDir, 'index.html'))
    })

    // Build once before starting server
    await appCTX.rebuild()
    copyHooksToPublic()
    copyPublic()
    copyWasmToAssets()
    // Note: copyHooksToDist() NOT called - we serve /hooks/* directly from public/hooks/
    copyHooksToTemplate()

    const server = http.createServer(app)
    const port = 5173
    server.listen(port, '0.0.0.0', () => {
      console.log(`[esbuild] serving at http://localhost:${port}`)
    })

    return { host: 'localhost', port }
  } else {
    const result = await build(opts)
    copyHooksToPublic()
    copyPublic()
    copyWasmToAssets()
    copyHooksToDist()
    copyHooksToTemplate()
    return { jsFile: 'main.js' }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const serve = process.argv.includes('--serve')
  bundle({ serve }).catch(err => {
    console.error('[esbuild] build failed', err)
    process.exit(1)
  })
}
