import { create } from 'zustand'
import { buildDirectHookUrlFromPresetBase, PRESET_REMOTE_TAB_ID } from '../config/presetRemoteHook'

export type PeerProtocol = 'https' | 'git' | 'ssh' | 'ipfs-api' | 'ipfs-gateway' | 'ipfs-swarm'

export interface PeerProbe {
    protocol: PeerProtocol
    port: number
    ok: boolean
    latencyMs?: number
    error?: string
}

export interface PeerInfo {
    host: string
    lastUpdateTs?: number // epoch millis from OPTIONS response
    probes: PeerProbe[]
    branches?: string[]
    repos?: string[]
    reposWithBranches?: Array<{ name: string; branches: Record<string, string> }>
    isProbing?: boolean
}

export interface TabInfo {
    id: string
    host?: string
    repo?: string
    path?: string
    title: string
    branches?: string[]
    currentBranch?: string
    reposList?: string[]
    isHome?: boolean
    // If set, render this tab as a direct hook (skip OPTIONS/discovery)
    directHookUrl?: string
    /** When set (embed shell), use this URL path for the client GET hook instead of OPTIONS-derived path */
    embedClientHookUrlPath?: string
}

export type ThemeName = 'default' | 'light' | 'dark'

export interface AppState {
    // Peers state
    peers: PeerInfo[]
    setPeers: (hosts: string[]) => void
    updatePeer: (host: string, updater: (p: PeerInfo) => PeerInfo) => void
    setPeerProbing: (host: string, isProbing: boolean) => void
    addPeer: (host: string) => void
    removePeer: (host: string) => void

    // Tabs state
    tabs: TabInfo[]
    activeTabId: string | null
    openTab: (host: string, path?: string) => string // Returns tab ID
    openDirectHookTab: (hookUrl: string, title?: string) => string
    closeTab: (tabId: string) => void // Won't close home tab
    setActiveTab: (tabId: string) => void
    updateTab: (tabId: string, updater: (t: TabInfo) => TabInfo) => void
    homeTabId: string

    // Theme state — shell (chrome) vs repo/hook surface inside RepoBrowser ShadowRoot
    shellTheme: ThemeName
    hookTheme: ThemeName
    setShellTheme: (theme: ThemeName) => void
    setHookTheme: (theme: ThemeName) => void
    /** @deprecated use shellTheme */
    theme: ThemeName
    /** @deprecated use setShellTheme */
    setTheme: (theme: ThemeName) => void

    // Auto-refresh state
    autoRefreshEnabled: boolean
    setAutoRefresh: (enabled: boolean) => void
    lastRefreshTs: number
    setLastRefreshTs: (ts: number) => void

    /** True when running the minimal embed entry (`embed-main`); skips persisting tabs/peers. */
    embedMode: boolean

    /** One-shot: replaces session state for server-rendered embed pages (+`#relay-embed-config`). */
    initEmbedSession: (cfg: {
        repo: string
        branch: string
        initialPath: string
        clientHookPath: string
    }) => void

    /** Fullscreen preset remote hook (main bundle): direct GET hook only, no Home chrome. */
    initPresetRemoteHookSession: (baseUrl: string) => void
}

let tabIdCounter = 0

function generateTabId(): string {
    return `tab-${++tabIdCounter}-${Date.now()}`
}

// Storage keys
export const STORAGE_KEY_TABS = 'relay_tabs'
export const STORAGE_KEY_ACTIVE_TAB = 'relay_active_tab'
export const STORAGE_KEY_PEERS = 'relay_peers'
/** Legacy single key — migrated once into shell + hook */
export const STORAGE_KEY_THEME = 'relay_theme'
export const STORAGE_KEY_THEME_SHELL = 'relay_theme_shell'
export const STORAGE_KEY_THEME_HOOK = 'relay_theme_hook'

function isValidThemeName (stored: string | null): stored is ThemeName {
    return stored === 'default' || stored === 'light' || stored === 'dark'
}

let legacyThemeMigrationRan = false

function migrateLegacyThemeOnce (): void {
    if (legacyThemeMigrationRan || typeof localStorage === 'undefined') return
    legacyThemeMigrationRan = true
    try {
        const legacy = localStorage.getItem(STORAGE_KEY_THEME)
        if (!legacy || !isValidThemeName(legacy)) return
        if (!localStorage.getItem(STORAGE_KEY_THEME_SHELL)) {
            localStorage.setItem(STORAGE_KEY_THEME_SHELL, legacy)
        }
        if (!localStorage.getItem(STORAGE_KEY_THEME_HOOK)) {
            localStorage.setItem(STORAGE_KEY_THEME_HOOK, legacy)
        }
        localStorage.removeItem(STORAGE_KEY_THEME)
    } catch (e) {
        console.error('Failed to migrate legacy relay_theme:', e)
    }
}

// Load persisted state from localStorage
function ensureCoreTabs(tabs: TabInfo[]): TabInfo[] {
    // Always ensure Home, Settings, and Test tabs exist
    const hasHome = tabs.some((t) => t.id === 'home')
    const hasSettings = tabs.some((t) => t.id === 'settings')
    const hasTest = tabs.some((t) => t.id === 'test')
    const result = [...tabs]
    if (!hasHome) {
        result.unshift({ id: 'home', title: 'Home', isHome: true })
    }
    if (!hasSettings) {
        result.push({ id: 'settings', title: 'Settings' })
    }
    if (!hasTest) {
        result.push({ id: 'test', title: 'Test' })
    }
    return result
}

function loadPersistedTabs() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_TABS)
        if (stored) {
            const parsed = JSON.parse(stored) as TabInfo[]
            return ensureCoreTabs(parsed)
        }
    } catch (e) {
        console.error('Failed to load persisted tabs:', e)
    }
    return ensureCoreTabs([
        {
            id: 'home',
            title: 'Home',
            isHome: true,
        } as TabInfo,
    ])
}

function loadPersistedActiveTab() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB)
        if (stored) {
            return stored
        }
    } catch (e) {
        console.error('Failed to load persisted active tab:', e)
    }
    return 'home'
}

// When true, embed shell must not overwrite the user's main-app persisted tabs.
let relayEmbedPersistenceDisabled = false

// Update localStorage to persist state
function persistTabs(tabs: TabInfo[], activeTabId: string) {
    try {
        if (relayEmbedPersistenceDisabled) {
            return
        }
        localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(tabs))
        localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, activeTabId)
    } catch (e) {
        console.error('Failed to persist state:', e)
    }
}

function persistPeers(peers: PeerInfo[]) {
    try {
        if (relayEmbedPersistenceDisabled) {
            return
        }
        const peerHosts = peers.map((p) => p.host)
        localStorage.setItem(STORAGE_KEY_PEERS, JSON.stringify(peerHosts))
    } catch (e) {
        console.error('Failed to persist peers:', e)
    }
}

function loadPersistedShellTheme (): ThemeName {
    migrateLegacyThemeOnce()
    try {
        const stored = localStorage.getItem(STORAGE_KEY_THEME_SHELL)
        if (isValidThemeName(stored)) {
            return stored
        }
    } catch (e) {
        console.error('Failed to load persisted shell theme:', e)
    }
    return 'default'
}

function loadPersistedHookTheme (): ThemeName {
    migrateLegacyThemeOnce()
    try {
        const stored = localStorage.getItem(STORAGE_KEY_THEME_HOOK)
        if (isValidThemeName(stored)) {
            return stored
        }
    } catch (e) {
        console.error('Failed to load persisted hook theme:', e)
    }
    return 'default'
}

function persistShellTheme (theme: ThemeName) {
    try {
        localStorage.setItem(STORAGE_KEY_THEME_SHELL, theme)
    } catch (e) {
        console.error('Failed to persist shell theme:', e)
    }
}

function persistHookTheme (theme: ThemeName) {
    try {
        localStorage.setItem(STORAGE_KEY_THEME_HOOK, theme)
    } catch (e) {
        console.error('Failed to persist hook theme:', e)
    }
}

export const useAppState = create<AppState>((set, get) => ({
    // Peers state
    peers: [],
    setPeers: (hosts) =>
        set(() => {
            const newPeers = hosts.map((h) => ({ host: h, probes: [] }))
            persistPeers(newPeers)
            return {
                peers: newPeers,
            }
        }),
    updatePeer: (host, updater) =>
        set((s) => ({
            peers: s.peers.map((p) => (p.host === host ? updater(p) : p)),
        })),
    setPeerProbing: (host, isProbing) =>
        set((s) => ({
            peers: s.peers.map((p) => (p.host === host ? { ...p, isProbing } : p)),
        })),
    addPeer: (host) =>
        set((s) => {
            // Keep the full URL as-is (including protocol)
            const cleanHost = host.trim()

            // Avoid adding duplicates
            if (s.peers.some((p) => p.host === cleanHost)) {
                return s
            }
            const newPeers = [...s.peers, { host: cleanHost, probes: [] }]
            persistPeers(newPeers)
            return {
                peers: newPeers,
            }
        }),
    removePeer: (host) =>
        set((s) => {
            const newPeers = s.peers.filter((p) => p.host !== host)
            persistPeers(newPeers)
            return {
                peers: newPeers,
            }
        }),

    // Tabs state
    tabs: loadPersistedTabs(),
    activeTabId: loadPersistedActiveTab(),
    homeTabId: 'home',
    openTab: (host, path = '/') => {
        const existingTab = get().tabs.find((t) => t.host === host && t.path === path)
        if (existingTab) {
            set({ activeTabId: existingTab.id })
            persistTabs(get().tabs, existingTab.id)
            return existingTab.id
        }

        const id = generateTabId()
        const newTab: TabInfo = {
            id,
            host,
            path,
            title: host,
        }
        set((s) => {
            const newTabs = [...s.tabs, newTab]
            persistTabs(newTabs, id)
            return {
                tabs: newTabs,
                activeTabId: id,
            }
        })
        return id
    },
    openDirectHookTab: (hookUrl, title = 'Direct Hook') => {
        // Avoid duplicate direct tabs for the same URL
        const existing = get().tabs.find((t) => t.directHookUrl === hookUrl)
        if (existing) {
            set({ activeTabId: existing.id })
            persistTabs(get().tabs, existing.id)
            return existing.id
        }

        const id = generateTabId()
        const newTab: TabInfo = {
            id,
            title,
            directHookUrl: hookUrl,
        }

        set((s) => {
            const newTabs = [...s.tabs, newTab]
            persistTabs(newTabs, id)
            return {
                tabs: newTabs,
                activeTabId: id,
            }
        })
        return id
    },
    closeTab: (tabId) =>
        set((s) => {
            if (tabId === PRESET_REMOTE_TAB_ID) return s
            // Don't close home tab
            if (tabId === 'home' || tabId === 'settings') return s
            const tabs = s.tabs.filter((t) => t.id !== tabId)
            const activeTabId = s.activeTabId === tabId ? (tabs.find((t) => t.id === 'home') ?? tabs[0])?.id || 'home' : s.activeTabId
            persistTabs(tabs, activeTabId || 'home')
            return { tabs, activeTabId }
        }),
    setActiveTab: (tabId) => {
        set({ activeTabId: tabId })
        persistTabs(get().tabs, tabId)
    },
    updateTab: (tabId, updater) =>
        set((s) => {
            const newTabs = s.tabs.map((t) => (t.id === tabId ? updater(t) : t))
            persistTabs(newTabs, s.activeTabId || 'home')
            return {
                tabs: newTabs,
            }
        }),

    // Theme state
    shellTheme: loadPersistedShellTheme(),
    hookTheme: loadPersistedHookTheme(),
    setShellTheme: (shellTheme) => {
        persistShellTheme(shellTheme)
        set({ shellTheme, theme: shellTheme })
    },
    setHookTheme: (hookTheme) => {
        persistHookTheme(hookTheme)
        set({ hookTheme })
    },
    theme: loadPersistedShellTheme(),
    setTheme: (theme) => {
        get().setShellTheme(theme)
    },

    // Auto-refresh state
    autoRefreshEnabled: false,
    setAutoRefresh: (enabled) =>
        set({ autoRefreshEnabled: enabled }),
    lastRefreshTs: 0,
    setLastRefreshTs: (ts) =>
        set({ lastRefreshTs: ts }),

    embedMode: false,
    initEmbedSession: (cfg) => {
        relayEmbedPersistenceDisabled = true
        const path =
            cfg.initialPath.startsWith('/') ? cfg.initialPath : `/${cfg.initialPath}`
        const hookPath =
            cfg.clientHookPath.startsWith('/') ? cfg.clientHookPath : `/${cfg.clientHookPath}`
        const origin =
            typeof window !== 'undefined' ? window.location.origin : ''
        set({
            embedMode: true,
            peers: [],
            tabs: [
                {
                    id: 'embed',
                    title: cfg.repo,
                    host: origin,
                    repo: cfg.repo,
                    path,
                    currentBranch: cfg.branch,
                    embedClientHookUrlPath: hookPath,
                },
            ],
            activeTabId: 'embed',
        })
    },
    initPresetRemoteHookSession: (baseUrl) => {
        relayEmbedPersistenceDisabled = true
        const directHookUrl = buildDirectHookUrlFromPresetBase(baseUrl)
        set({
            embedMode: true,
            peers: [],
            tabs: [
                {
                    id: PRESET_REMOTE_TAB_ID,
                    title: 'Remote hook',
                    directHookUrl,
                },
            ],
            activeTabId: PRESET_REMOTE_TAB_ID,
        })
    },
}))
