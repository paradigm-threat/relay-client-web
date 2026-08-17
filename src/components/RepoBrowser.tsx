import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../state/store'
import { RepoFetchProvider } from '../context/RepoFetchContext'
import HookRenderer from './ThemedHookRenderer'
import { RepoBrowserShadowRoot } from './RepoBrowserShadowRoot'
import { TSDiv } from './TSDiv'
import {
  applyDefaultClientGetHook,
  repoRelativeHookPathToUrlPath,
  staticRelayOptionsFallback,
} from '../constants/relayClientDefaults'
import { detectClientHook, unsupportedMessage } from '../services/hookDetect'

interface RepoBrowserProps {
    tabId: string
}

interface OptionsInfo {
    // Entire OPTIONS payload merged from .relay.yaml + server additions
    client?: {
        hooks?: {
            get?: { path: string }
            query?: { path: string }
        }
    }
    repos?: { name: string; branches: Record<string, string> }[]
    capabilities?: { supports: string[] }

    [key: string]: unknown
}

/** Diagnostics object built by hook renderer / fetch paths; UI maps common fields */
interface RepoBrowserHookDiagnostics {
    kind?: string
    hookUrl?: string
    fetch?: { status: number; ok: boolean; contentType?: string }
    codeLength?: number
    reason?: string
    jsxError?: unknown
    isWasmNotLoaded?: boolean
    isJsxSyntaxError?: boolean
    error?: string
    diagnosticMsg?: string
    transpilerVersion?: string | number
    transpilerDiagnostic?: string
    finalCodeSnippet?: string
    transpiledCodeSnippet?: string
    stack?: unknown
    fetchJson?: {
        url?: string
        status?: unknown
        ok?: boolean
        contentType?: string
        sample?: string
    }
    phase?: string
    optionsInfo?: unknown
}

interface GitPullResultState {
    success?: boolean
    message?: string
    before_commit?: string
    after_commit?: string
    updated?: boolean
    error?: string
}

function renderHookKindDiagnosticsPanel (d: RepoBrowserHookDiagnostics): React.JSX.Element | null {
    const k = d.kind
    if (typeof k !== 'string' || k.length === 0) return null
    return (
        <TSDiv className="bg-red-600/10 p-3 rounded border/50">
            <TSDiv className="font-mono text-xs space-y-1">
                <TSDiv><TSDiv tag="strong">Hook Type:</TSDiv> {k}</TSDiv>
                {d.hookUrl && (
                    <TSDiv className="break-all"><TSDiv tag="strong">GET URL:</TSDiv> <TSDiv tag="code"
                        className="bg-black/20 px-1 py-0.5 rounded">{d.hookUrl}</TSDiv>
                    </TSDiv>
                )}
                {d.fetch && (
                    <>
                        <TSDiv><TSDiv tag="strong">HTTP
                            Status:</TSDiv> {d.fetch.status} {d.fetch.ok ? '✓' : '✗'}
                        </TSDiv>
                        <TSDiv>
                            <TSDiv tag="strong">Content-Type:</TSDiv> {d.fetch.contentType || 'not specified'}
                        </TSDiv>
                    </>
                )}
                {d.codeLength && (
                    <TSDiv><TSDiv tag="strong">Code
                        Length:</TSDiv> {d.codeLength} bytes</TSDiv>
                )}
            </TSDiv>
        </TSDiv>
    )
}

function renderLastTranspiledSnippet (d: RepoBrowserHookDiagnostics): React.JSX.Element | null {
    const snippet = d.transpiledCodeSnippet
    if (typeof snippet !== 'string' || snippet.length === 0) return null
    return (
        <TSDiv tag="details" className="text-xs bg-black/10 border border-black/20 rounded p-2 mb-2">
            <TSDiv tag="summary" className="cursor-pointer">Last transpiler output (window.__lastTranspiledCode)</TSDiv>
            <TSDiv tag="pre" className="overflow-auto max-h-32 text-[11px] mt-1 whitespace-pre-wrap">{snippet}</TSDiv>
        </TSDiv>
    )
}

function formatUnknownJsxError (jsxError: unknown): string {
    if (typeof jsxError === 'string') return jsxError
    if (jsxError && typeof jsxError === 'object' && jsxError !== null && 'message' in jsxError) {
        const m = (jsxError as { message?: unknown }).message
        if (typeof m === 'string' && m.length) return m
    }
    try {
        return JSON.stringify(jsxError, null, 2)
    } catch {
        return String(jsxError)
    }
}

/**
 * Helper to normalize host URL - ensures proper protocol is added if missing
 */
function normalizeHostUrl(host: string): string {
    if (host.startsWith('http://') || host.startsWith('https://')) {
        return host
    }
    if (host.includes(':')) {
        return `http://${host}` // Has port, assume http
    }
    return `https://${host}` // No port, assume https
}

function splitHookUrl(hookUrl: string): { host: string; hookPath: string } {
    try {
        const url = new URL(hookUrl)
        const HOOK_SEGMENT = '/hooks/'
        const idx = url.pathname.indexOf(HOOK_SEGMENT)
        const basePath = idx >= 0 ? url.pathname.slice(0, idx) : ''
        const path = idx >= 0 ? url.pathname.slice(idx) : url.pathname
        const hookPath = `${path}${url.search || ''}` || '/hooks/client/get.jsx'
        const host = `${url.origin}${basePath}`
        return { host, hookPath }
    } catch {
        // Fallback: treat entire URL as host and use default hook path
        return { host: hookUrl, hookPath: '/hooks/client/get.jsx' }
    }
}

export function RepoBrowser({ tabId }: RepoBrowserProps) {
    const tab = useAppState((s) => s.tabs.find((t) => t.id === tabId))
    const embedMode = useAppState((s) => s.embedMode)
    const updateTab = useAppState((s) => s.updateTab)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [hookDiag, setHookDiag] = useState<RepoBrowserHookDiagnostics | null>(null)
    const [optionsInfo, setOptionsInfo] = useState<OptionsInfo>({})
    // Hook rendering delegated to HookRenderer component
    // Server version and git pull state
    const [serverHeadCommit, setServerHeadCommit] = useState<string | null>(null)
    const [isPulling, setIsPulling] = useState(false)
    const [pullResult, setPullResult] = useState<GitPullResultState | null>(null)
    const [showUpdateModal, setShowUpdateModal] = useState(false)
    /** Bumps to re-run OPTIONS/content load without a full page reload */
    const [refreshEpoch, setRefreshEpoch] = useState(0)
    const [hookUnsupported, setHookUnsupported] = useState<string | null>(null)
    // Client is now dumb: search and navigation UI are moved into repo layout
    // Keep minimal state only for hook/file rendering

    // Get server version from OPTIONS response (already includes branch commit hash)
    const fetchServerVersion = async (opts: OptionsInfo) => {
        if (!opts?.repos?.[0]?.branches) return
        try {
            const currentBranch = tab?.currentBranch || 'main'
            const commitHash = opts.repos[0].branches[currentBranch]
            if (commitHash) {
                setServerHeadCommit(commitHash.substring(0, 7)) // Short hash
            }
        } catch (e) {
            console.debug('[RepoBrowser] Could not extract commit hash from OPTIONS:', e)
        }
    }

    // Handle git pull from server
    const handleGitPull = async () => {
        if (!tab || !tab.host) return
        setIsPulling(true)
        try {
            const baseUrl = normalizeHostUrl(tab.host)
            const resp = await fetch(`${baseUrl}/git-pull`, { method: 'POST' })
            const result = (await resp.json()) as GitPullResultState
            setPullResult(result)

            if (result.updated) {
                setShowUpdateModal(true)
            }
        } catch (e) {
            console.error('[RepoBrowser] Git pull failed:', e)
            setPullResult({
                success: false,
                message: 'Failed to pull from server',
                error: e instanceof Error ? e.message : String(e),
            })
        } finally {
            setIsPulling(false)
        }
    }

    // Refresh page after update
    const handleRefresh = () => {
        setRefreshEpoch((n) => n + 1)
    }

    useEffect(() => {
        if (!tab) {
            setLoading(false)
            return
        }

        // Direct hook tabs skip OPTIONS/discovery entirely
        if (tab.directHookUrl) {
            setLoading(false)
            setError(null)
            setHookDiag(null)
            setHookUnsupported(null)
            return
        }

        if (tab.unsupported) {
            setLoading(false)
            setError(null)
            setHookDiag(null)
            setHookUnsupported(tab.unsupportedReason || unsupportedMessage('not_found'))
            return
        }

        if (!tab.host) {
            setLoading(false)
            setError('This tab has no relay host; close it and open a repo from Home.')
            return
        }

        (async () => {
            try {
                const opts = await loadOptions()
                if (opts) {
                    await loadContent(opts)
                    await fetchServerVersion(opts)
                }
            } catch (e) {
                console.error('[RepoBrowser] init failed:', e)
            }
        })()
        // loadOptions/loadContent close over `tab`; effect is keyed by tab identity fields.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab?.host, tab?.path, tab?.directHookUrl, tab?.id, tab?.unsupported, refreshEpoch])

    const loadOptions = async (): Promise<OptionsInfo | null> => {
        if (!tab || !tab.host) return null
        setHookUnsupported(null)

        const finishWithStaticFallback = (
            diag: Record<string, unknown>,
            hint: string,
        ): OptionsInfo => {
            console.warn('[RepoBrowser]', hint, diag)
            diag.fallback = 'options-unavailable-static-default-hook'
            const merged = staticRelayOptionsFallback() as OptionsInfo
            setError(null)
            setHookDiag(null)
            setOptionsInfo(merged)
            const branches =
                merged.repos?.[0]?.branches ? Object.keys(merged.repos[0].branches) : undefined
            updateTab(tab.id, (t) => ({
                ...t,
                branches,
                reposList: merged.repos?.map((r) => r.name),
            }))
            return merged
        }

        const baseUrl = normalizeHostUrl(tab.host)
        const diagnostics: Record<string, unknown> = { phase: 'options', url: `${baseUrl}/` }

        let resp: Response | null = null
        try {
            resp = await fetch(`${baseUrl}/`, { method: 'OPTIONS', headers: { Accept: 'application/json' } })
        } catch (fetchErr) {
            diagnostics.optionsFetchError =
                fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
            resp = null
        }

        if (resp) {
            diagnostics.options = {
                status: resp.status,
                ok: resp.ok,
                headers: {
                    'content-type': resp.headers.get('content-type'),
                    'content-length': resp.headers.get('content-length'),
                },
            }
        }

        let options: OptionsInfo | null = null
        let parsedFrom: 'OPTIONS' | null = null

        if (resp) {
            try {
                const text = await resp.text()
                diagnostics.optionsBodyLength = text?.length || 0
                if (text && text.trim().length > 0) {
                    options = JSON.parse(text) as OptionsInfo
                    parsedFrom = 'OPTIONS'
                }
            } catch (parseErr) {
                diagnostics.optionsParseError = parseErr instanceof Error ? parseErr.message : String(parseErr)
            }
        }

        const hookPath =
            options?.client?.hooks?.get?.path
            || 'hooks/client/get.jsx'
        const hook = await detectClientHook(baseUrl, hookPath)
        if (!hook.ok) {
            const msg = unsupportedMessage(hook.reason)
            setHookUnsupported(msg)
            setError(null)
            setHookDiag({ phase: 'hook-detect', reason: hook.reason, ...diagnostics })
            setLoading(false)
            return null
        }

        const hasValidRepos =
            options &&
            Array.isArray(options.repos) &&
            options.repos.length > 0

        if (hasValidRepos) {
            const merged = applyDefaultClientGetHook(options as OptionsInfo)
            setOptionsInfo(merged)
            diagnostics.parsedFrom = parsedFrom
            const branches =
                merged.repos?.[0]?.branches ? Object.keys(merged.repos[0].branches) : undefined
            updateTab(tab.id, (t) => ({
                ...t,
                branches,
                reposList: merged.repos?.map((r) => r.name),
            }))
            return merged
        }

        diagnostics.fallbackHint =
            diagnostics.optionsFetchError
            ?? (resp && !resp.ok ? `OPTIONS status ${resp.status}` : 'empty or invalid OPTIONS body / no repos')
        return finishWithStaticFallback(
            diagnostics,
            'OPTIONS unavailable or empty; hook file present — using default GET hook path',
        )
    }

    const loadContent = async (opts?: OptionsInfo | null) => {
        if (!tab || !tab.host) return

        setLoading(true)
        setError(null)

        try {
            const raw = opts ?? optionsInfo
            if (hookUnsupported) {
                return
            }
            if (!raw || !Array.isArray(raw.repos) || raw.repos.length === 0) {
                setError('Repository discovery did not return usable repo metadata. See details for diagnostics.')
                setHookDiag({ phase: 'render', reason: 'no-options', optionsInfo: raw })
                return
            }

            // HookRenderer will be rendered by this component; nothing else to do here.
            // loadContent only verifies options and updates auxiliary state
            return
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load content')
            setHookDiag({
                reason: 'load-content-failed',
                error: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined,
            })
        } finally {
            setLoading(false)
        }
    }

    // navigation is handled via helpers passed into hooks; RepoBrowser itself doesn't navigate directly here

    // Client no longer owns search or direct content rendering; repo hook must render everything.



    /**
     * Resolves paths within /template context
     * Handles both relative paths (./foo, ../foo) and absolute paths (/hooks/foo)
     * Returns properly formatted URL without double slashes
     */
    // Module path resolution and hook helpers are provided inside HookRenderer now.

    const repoBaseUrl = useMemo(() => (tab?.host ? normalizeHostUrl(tab.host) : '/'), [tab?.host])
    const providerResolve = useMemo(
      () => (p: string) => {
        const path = p.startsWith('/') ? p.slice(1) : p
        return new URL(path, repoBaseUrl).toString()
      },
      [repoBaseUrl]
    )
    const providerFetch = useMemo(
      () => (input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof input === 'string') {
          const isAbs = /^(https?:)?\/\//i.test(input)
          return fetch(isAbs ? input : providerResolve(input), init)
        }
        if (input instanceof URL) return fetch(input.toString(), init)
        return fetch(input, init)
      },
      [providerResolve]
    )

    const providerFetchJson = useMemo(
      () => async (p: string, init?: RequestInit) => {
        const url = providerResolve(p)
        const resp = await fetch(url, init)
        const ct = (resp.headers.get('content-type') || '').toLowerCase()
        const text = await resp.text()
        const mkErr = (message: string) => {
          const err = new Error(message) as Error & {
            name: string
            details: Record<string, unknown>
          }
          err.name = 'RepoFetchJsonError'
          err.details = { url, status: resp.status, ok: resp.ok, contentType: ct, sample: text.slice(0, 256) }
          return err
        }
        if (!resp.ok) throw mkErr(`HTTP ${resp.status} while fetching JSON: ${url}`)
        if (!ct.includes('application/json')) {
          if (text.trim().startsWith('<')) {
            throw mkErr('Expected JSON but received HTML (likely SPA fallback)')
          }
        }
        try {
          return JSON.parse(text)
        } catch (err) {
          throw mkErr(`Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`)
        }
      },
      [providerResolve]
    )

    const resolvedHookUrlPath = useMemo(() => {
        if (tab?.embedClientHookUrlPath) {
            return tab.embedClientHookUrlPath
        }
        const p = optionsInfo?.client?.hooks?.get?.path ?? 'hooks/client/get.jsx'
        return repoRelativeHookPathToUrlPath(p)
    }, [optionsInfo, tab?.embedClientHookUrlPath])

    if (!tab) {
      return <div className="repo-browser">Tab not found</div>
    }

    return (
        <RepoFetchProvider value={{
            baseUrl: repoBaseUrl,
            resolve: providerResolve,
            fetch: providerFetch,
            fetchJson: providerFetchJson
        }}>
            <RepoBrowserShadowRoot>
            <TSDiv className="flex flex-col h-full min-h-0">
                <TSDiv className="flex-1 min-h-0 overflow-hidden">

                        {loading &&
                            <TSDiv className="flex items-center justify-center h-full">Loading...</TSDiv>}

                        {hookUnsupported && (
                            <TSDiv className="flex flex-col items-center justify-center h-full p-8 text-center max-w-lg mx-auto">
                                <TSDiv tag="h2" className="text-xl font-semibold mb-2">Not supported</TSDiv>
                                <TSDiv tag="p" className="text-sm text-[var(--text-secondary)]">{hookUnsupported}</TSDiv>
                                {tab.host && (
                                    <TSDiv tag="p" className="mt-3 text-xs font-mono break-all opacity-70">{tab.host}</TSDiv>
                                )}
                            </TSDiv>
                        )}

                        {error && (
                            <TSDiv
                                className="p-8 bg-[var(--bg-error)] border border-[var(--border-error)] rounded-lg text-[var(--text-error)]">
                                <TSDiv tag="h3" className="mt-0">Error</TSDiv>
                                <TSDiv tag="p" className="font-semibold">{error}</TSDiv>

                                {hookDiag && (
                                    <TSDiv className="mt-4 space-y-3 text-sm">
                                        {/* Show hook path and HTTP request info */}
                                        {renderHookKindDiagnosticsPanel(hookDiag)}

                                        {/* Show JSX transpilation errors (from transpileCode failure) */}
                                        {(hookDiag.reason === 'transpile-failed' || hookDiag.jsxError != null) && (
                                            <TSDiv className="bg-red-600/10 p-3 rounded border/50 space-y-2">
                                                <TSDiv className="font-semibold text-xs">
                                                    {hookDiag.isWasmNotLoaded ? '🔌 WASM Transpiler Not Available' : '❌ JSX Transpilation Failed'}
                                                </TSDiv>

                                                {hookDiag.isWasmNotLoaded && (
                                                    <TSDiv className="text-xs bg-red-900/20 border/30 rounded p-2 space-y-1">
                                                        <TSDiv tag="p" className="font-semibold">The JSX transpiler (WASM) is not available</TSDiv>
                                                        <TSDiv tag="p">This usually means:</TSDiv>
                                                        <TSDiv tag="ul" className="list-disc list-inside ml-2 space-y-1">
                                                            <TSDiv tag="li">The app didn't fully load when you started browsing</TSDiv>
                                                            <TSDiv tag="li">Your browser blocked WASM module loading</TSDiv>
                                                            <TSDiv tag="li">Network issue prevented transpiler from downloading</TSDiv>
                                                        </TSDiv>
                                                        <TSDiv tag="p" className="mt-2"><TSDiv tag="strong">Fix:</TSDiv> Refresh the page and try again. Check browser console (F12) for errors.</TSDiv>
                                                    </TSDiv>
                                                )}

                                                {!hookDiag.isWasmNotLoaded && (
                                                    <TSDiv className="text-xs bg-red-900/20 border/30 rounded p-2 space-y-1">
                                                        <TSDiv tag="p" className="font-semibold">Invalid JSX syntax detected</TSDiv>
                                                        <TSDiv tag="p">The transpiler encountered syntax it couldn't convert. Check:</TSDiv>
                                                        <TSDiv tag="ul" className="list-disc list-inside ml-2 space-y-1">
                                                            <TSDiv tag="li">All JSX tags are properly closed</TSDiv>
                                                            <TSDiv tag="li">Attributes are correctly formatted</TSDiv>
                                                            <TSDiv tag="li">No special characters in tag names</TSDiv>
                                                        </TSDiv>
                                                    </TSDiv>
                                                )}

                                                <TSDiv className="font-mono text-xs bg-black/20 p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap">
                                                    {formatUnknownJsxError(hookDiag.jsxError)}
                                                </TSDiv>
                                            </TSDiv>
                                        )}

                                        {/* Show execution errors */}
                                        {hookDiag.reason === 'execution-failed' && hookDiag.error && (
                                            <TSDiv className={`p-3 rounded border ${hookDiag.isJsxSyntaxError ? 'bg-orange-600/10 border-orange-400/50' : 'bg-red-600/10/50'}`}>
                                                <TSDiv className="font-semibold text-xs mb-3">
                                                    {hookDiag.isJsxSyntaxError ? '⚠️ JSX Transpilation Issue' : '❌ Execution Error'}
                                                </TSDiv>

                                                {/* For JSX syntax errors, provide detailed help */}
                                                {hookDiag.isJsxSyntaxError && (
                                                    <TSDiv className="space-y-2 mb-3">
                                                        <TSDiv className="text-xs bg-orange-900/20 border border-orange-400/30 rounded p-2">
                                                            <TSDiv tag="p" className="font-semibold mb-2">What went wrong:</TSDiv>
                                                            <TSDiv tag="p" className="mb-2">The code contains JSX syntax (<TSDiv tag="code">&lt;</TSDiv> character), but it wasn't converted to regular JavaScript before execution.</TSDiv>
                                                        </TSDiv>
                                                        <TSDiv className="text-xs bg-blue-900/20 border border-blue-400/30 rounded p-2">
                                                            <TSDiv tag="p" className="font-semibold mb-2">Common causes:</TSDiv>
                                                            <TSDiv tag="ul" className="list-disc list-inside space-y-1">
                                                                <TSDiv tag="li"><TSDiv tag="strong">WASM transpiler failed to load:</TSDiv> Check browser console for WASM errors</TSDiv>
                                                                <TSDiv tag="li"><TSDiv tag="strong">Invalid JSX syntax:</TSDiv> Ensure JSX tags are properly closed (e.g., <TSDiv tag="code">&lt;div&gt;content&lt;/div&gt;</TSDiv>)</TSDiv>
                                                                <TSDiv tag="li"><TSDiv tag="strong">Missing React import:</TSDiv> Add <TSDiv tag="code">const h = React.createElement</TSDiv> or equivalent</TSDiv>
                                                                <TSDiv tag="li"><TSDiv tag="strong">Wrong file type:</TSDiv> Use .jsx or .tsx extension, or add <TSDiv tag="code">// @use-jsx</TSDiv> comment at the top</TSDiv>
                                                            </TSDiv>
                                                        </TSDiv>
                                                        <TSDiv className="text-xs bg-green-900/20 border rounded p-2">
                                                            <TSDiv tag="p" className="font-semibold mb-2">How to fix:</TSDiv>
                                                            <TSDiv tag="ul" className="list-disc list-inside space-y-1">
                                                                <TSDiv tag="li">Verify the hook file has .jsx or .tsx extension</TSDiv>
                                                                <TSDiv tag="li">Check the browser's developer console (F12) for detailed transpiler errors</TSDiv>
                                                                <TSDiv tag="li">Ensure JSX is properly formatted: <TSDiv tag="code">&lt;ComponentName prop="value"&gt;</TSDiv></TSDiv>
                                                                <TSDiv tag="li">For debugging, try uploading a simple JSX file first: <TSDiv tag="code">&lt;div&gt;Hello&lt;/div&gt;</TSDiv></TSDiv>
                                                            </TSDiv>
                                                        </TSDiv>
                                                    </TSDiv>
                                                )}

                                                <TSDiv className="font-mono text-xs mb-2">
                                                    <TSDiv tag="strong">Error Message:</TSDiv> {hookDiag.error}
                                                </TSDiv>
                                                {hookDiag.diagnosticMsg && (
                                                    <TSDiv className="font-mono text-xs mb-2 bg-black/20 p-2 rounded whitespace-pre-wrap">
                                                        <TSDiv tag="strong">Diagnostic:</TSDiv>
                                                        <TSDiv className="mt-1">
                                                            {hookDiag.diagnosticMsg}
                                                        </TSDiv>
                                                    </TSDiv>
                                                )}
                                                {hookDiag.transpilerVersion && (
                                                    <TSDiv className="font-mono text-xs mb-2 text-blue-100">
                                                        <TSDiv tag="strong">Hook transpiler:</TSDiv> v{hookDiag.transpilerVersion}
                                                    </TSDiv>
                                                )}
                                                {hookDiag.transpilerDiagnostic && (
                                                    <TSDiv className="font-mono text-xs bg-black/30 rounded p-2 mb-2 break-words">
                                                        <TSDiv tag="strong">Transpiler error:</TSDiv>
                                                        <TSDiv className="mt-1 text-[11px] whitespace-pre-wrap">
                                                            {hookDiag.transpilerDiagnostic}
                                                        </TSDiv>
                                                    </TSDiv>
                                                )}
                                                {hookDiag.finalCodeSnippet && (
                                                    <TSDiv tag="details" className="text-xs bg-black/10 border border-black/20 rounded p-2 mb-2">
                                                        <TSDiv tag="summary" className="cursor-pointer">Transpiled preview (first 500 chars)</TSDiv>
                                                        <TSDiv tag="pre" className="overflow-auto max-h-32 text-[11px] mt-1 whitespace-pre-wrap">{hookDiag.finalCodeSnippet}</TSDiv>
                                                    </TSDiv>
                                                )}
                                                {renderLastTranspiledSnippet(hookDiag)}
                                                {Array.isArray(hookDiag.stack) && (
                                                    <TSDiv tag="details" className="text-xs">
                                                        <TSDiv tag="summary" className="cursor-pointer hover:underline opacity-70 mb-1">Stack trace</TSDiv>
                                                        <TSDiv tag="pre"
                                                            className="overflow-auto max-h-24 whitespace-pre-wrap opacity-60 bg-black/20 p-2 rounded">
                                                            {(hookDiag.stack as unknown[])
                                                                .filter((s): s is string => typeof s === 'string')
                                                                .join('\n')}
                                                        </TSDiv>
                                                    </TSDiv>
                                                )}
                                            </TSDiv>
                                        )}

                                        {/* Repo fetch JSON mismatch diagnostics */}
                                        {hookDiag.fetchJson && (
                                            <TSDiv className="bg-yellow-600/10 p-3 rounded border border-yellow-400/50">
                                                <TSDiv className="font-semibold text-xs mb-2">Expected JSON but got HTML
                                                    (likely SPA fallback)
                                                </TSDiv>
                                                <TSDiv className="text-xs space-y-1 font-mono">
                                                    <TSDiv><TSDiv tag="strong">URL:</TSDiv> {hookDiag.fetchJson.url}</TSDiv>
                                                    <TSDiv>
                                                        <TSDiv tag="strong">Status:</TSDiv> {String(hookDiag.fetchJson.status)} ({hookDiag.fetchJson.ok ? 'ok' : 'error'})
                                                    </TSDiv>
                                                    <TSDiv>
                                                        <TSDiv tag="strong">Content-Type:</TSDiv> {hookDiag.fetchJson.contentType || 'n/a'}
                                                    </TSDiv>
                                                    {hookDiag.fetchJson.sample && (
                                                        <TSDiv tag="details" className="mt-2">
                                                            <TSDiv tag="summary" className="cursor-pointer">Response sample
                                                            </TSDiv>
                                                            <TSDiv tag="pre"
                                                                className="mt-1 max-h-40 overflow-auto bg-black/20 p-2 rounded">{hookDiag.fetchJson.sample}</TSDiv>
                                                        </TSDiv>
                                                    )}
                                                </TSDiv>
                                                <TSDiv className="text-xs mt-2 opacity-80">
                                                    Tips: Ensure the file exists in the repository, and that the relay
                                                    server serves it at the path above. If nginx SPA fallback is
                                                    enabled, upstream 404 may be converted into 200 HTML.
                                                </TSDiv>
                                            </TSDiv>
                                        )}

                                        {/* Show general diagnostics */}
                                        {hookDiag.reason && (
                                            <TSDiv className="text-xs opacity-80">
                                                <TSDiv tag="strong">Phase:</TSDiv> {hookDiag.phase || 'unknown'} | <TSDiv tag="strong">Reason:</TSDiv> {hookDiag.reason}
                                            </TSDiv>
                                        )}
                                    </TSDiv>
                                )}

                                <TSDiv className="mt-4 text-sm opacity-80">
                                    <TSDiv className="font-semibold mb-2">Troubleshooting:</TSDiv>
                                    <TSDiv tag="ul" className="list-disc pl-5 space-y-1">
                                        <TSDiv tag="li">Prefer explicit paths in <TSDiv tag="code">.relay.yaml</TSDiv> under <TSDiv tag="code">client.hooks</TSDiv> (optional on current gateways). If omitted, the server and client assume the default GET hook <TSDiv tag="code">hooks/client/get.jsx</TSDiv>. Add <TSDiv tag="code">client.hooks.query.path</TSDiv> when you use a search/query hook.
                                        </TSDiv>
                                        <TSDiv tag="li">Ensure the hook module exports a default function: <TSDiv tag="code">export default
                                            async
                                            function(ctx) {'{'} return ... {'}'} </TSDiv></TSDiv>
                                        <TSDiv tag="li">If using JSX, add a top-of-file comment <TSDiv tag="code">// @use-jsx</TSDiv> or
                                            use <TSDiv tag="code">.jsx</TSDiv>/<TSDiv tag="code">.tsx</TSDiv> extension.
                                        </TSDiv>
                                        <TSDiv tag="li">Check browser console (F12) for detailed logs starting
                                            with <TSDiv tag="code">[Hook]</TSDiv> or <TSDiv tag="code">[RepoBrowser]</TSDiv>.
                                        </TSDiv>
                                    </TSDiv>
                                </TSDiv>

                                {/* Show full JSON for debugging */}
                                <TSDiv tag="details" className="mt-4 text-xs opacity-70">
                                    <TSDiv tag="summary" className="cursor-pointer font-semibold">Full Diagnostics (JSON)</TSDiv>
                                    <TSDiv tag="pre"
                                        className="mt-2 overflow-auto max-h-64 whitespace-pre-wrap bg-black/20 p-2 rounded">
                                        {JSON.stringify(hookDiag, null, 2)}
                                    </TSDiv>
                                </TSDiv>

                                <TSDiv
                                    tag="button"
                                    onClick={() => {
                                        setError(null)
                                        setHookDiag(null)
                                        setRefreshEpoch((n) => n + 1)
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white border-none rounded cursor-pointer mt-4 hover:bg-red-700">Try
                                    Again
                                </TSDiv>
                            </TSDiv>
                        )}

                        {!loading && !hookUnsupported && (
                            tab?.directHookUrl ? (
                                (() => {
                                    const { host, hookPath } = splitHookUrl(tab.directHookUrl!)
                                    return <HookRenderer host={host} hookPath={hookPath} />
                                })()
                            ) : (
                                tab?.host ? <HookRenderer host={tab.host} hookPath={resolvedHookUrlPath} /> : null
                            )
                        )}
                        {/* No placeholders: if the hook didn't render and there's no error, render nothing */}
                    </TSDiv>

                {/* Footer with version and git pull button */}
                {!embedMode && !hookUnsupported && (
                <TSDiv
                    className="border-t bg-[var(--bg-secondary)] px-4 py-3 flex items-center justify-between">
                    <TSDiv className="text-sm text-[var(--text-secondary)]">
                        {serverHeadCommit ? (
                            <TSDiv tag="span">
                                Version: <TSDiv tag="code"
                                    className="bg-[var(--bg-code)] px-2 py-1 rounded text-xs">{serverHeadCommit}</TSDiv>
                            </TSDiv>
                        ) : (
                            <TSDiv tag="span">Version: loading...</TSDiv>
                        )}
                    </TSDiv>
                    <TSDiv
                        tag="button"
                        onClick={handleGitPull}
                        disabled={isPulling}
                        className={`px-4 py-2 rounded text-sm font-medium transition ${isPulling
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                            }`}
                        title={isPulling ? 'Pulling updates...' : 'Pull latest updates from origin'}
                    >
                        {isPulling ? '⟳ Pulling...' : `⟳ Pull${serverHeadCommit ? ` (${serverHeadCommit})` : ''}`}
                    </TSDiv>
                </TSDiv>
                )}

                {/* Update modal */}
                {showUpdateModal && (
                    <TSDiv className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <TSDiv className="bg-[var(--bg-surface)] rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                            <TSDiv tag="h2" className="text-xl font-bold mb-4 text-[var(--text)]">
                                Update Available
                            </TSDiv>
                            {pullResult && (
                                <TSDiv className="space-y-3 text-[var(--text)]">
                                    <TSDiv tag="p">
                                        <TSDiv tag="strong">Status:</TSDiv> {pullResult.success ? '✓ Success' : '✗ Failed'}
                                    </TSDiv>
                                    <TSDiv tag="p">
                                        <TSDiv tag="strong">Message:</TSDiv> {pullResult.message}
                                    </TSDiv>
                                    {pullResult.before_commit && (
                                        <TSDiv tag="p">
                                            <TSDiv tag="strong">Before:</TSDiv>{' '}
                                            <TSDiv tag="code" className="bg-[var(--bg-code)] px-2 py-1 rounded text-xs">
                                                {pullResult.before_commit.substring(0, 7)}
                                            </TSDiv>
                                        </TSDiv>
                                    )}
                                    {pullResult.after_commit && (
                                        <TSDiv tag="p">
                                            <TSDiv tag="strong">After:</TSDiv>{' '}
                                            <TSDiv tag="code" className="bg-[var(--bg-code)] px-2 py-1 rounded text-xs">
                                                {pullResult.after_commit.substring(0, 7)}
                                            </TSDiv>
                                        </TSDiv>
                                    )}
                                </TSDiv>
                            )}
                            <TSDiv className="flex gap-3 mt-6">
                                <TSDiv
                                    tag="button"
                                    onClick={() => setShowUpdateModal(false)}
                                    className="flex-1 px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text)] rounded transition"
                                >
                                    Close
                                </TSDiv>
                                <TSDiv
                                    tag="button"
                                    onClick={handleRefresh}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
                                >
                                    Refresh
                                </TSDiv>
                            </TSDiv>
                        </TSDiv>
                    </TSDiv>
                )}
            </TSDiv>
            </RepoBrowserShadowRoot>
        </RepoFetchProvider>
    )
}

/**
 * Build a URL to fetch content from a peer
 * (imported from @clevertree/client-shared for consistency with Android/iOS Native client)
 */
