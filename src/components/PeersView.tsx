import {useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent} from 'react'
import {type PeerInfo, STORAGE_KEY_PEERS, useAppState} from '../state/store'
import {fullProbePeer} from '../services/probing'
import {fetchNodeStatus} from '../services/nodeStatus'
import {detectClientHookWithOptions, unsupportedMessage} from '../services/hookDetect'
import {
    classifyAddedUrl,
    hostnameOf,
    migrateStoredPeerHosts,
    repoSiteOrigin,
} from '../constants/liveFleet'
import {TSDiv} from './TSDiv'

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000

interface PeersViewProps {
    onOpenRepo?: (siteOrigin: string, repo: string) => void
    onOpenSite?: (origin: string) => void
    onUnsupported?: (url: string, reason: string) => void
}

export function PeersView({onOpenRepo, onOpenSite, onUnsupported}: PeersViewProps) {
    const peers = useAppState((s) => s.peers)
    const setPeers = useAppState((s) => s.setPeers)
    const updatePeer = useAppState((s) => s.updatePeer)
    const setPeerProbing = useAppState((s) => s.setPeerProbing)
    const setLastRefreshTs = useAppState((s) => s.setLastRefreshTs)
    const addPeer = useAppState((s) => s.addPeer)
    const removePeer = useAppState((s) => s.removePeer)
    const [newPeerInput, setNewPeerInput] = useState('')
    const [addBusy, setAddBusy] = useState(false)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const probePeer = useCallback(
        async (host: string) => {
            setPeerProbing(host, true)
            try {
                const result = await fullProbePeer(host)
                updatePeer(host, (p) => ({
                    ...p,
                    probes: result.probes,
                    lastUpdateTs: result.lastUpdateTs,
                    repos: result.repos,
                    statusRepos: result.statusRepos,
                    gatewayVersion: result.gatewayVersion,
                    repoCount: result.repoCount,
                    nodeFqdn: result.nodeFqdn,
                    healthy: result.healthy,
                    isProbing: false,
                }))
            } catch {
                updatePeer(host, (p) => ({
                    ...p,
                    isProbing: false,
                }))
            }
        },
        [setPeerProbing, updatePeer],
    )

    const probeAllPeers = useCallback(async () => {
        const currentPeers = useAppState.getState().peers
        await Promise.all(currentPeers.map((p) => probePeer(p.host)))
        setLastRefreshTs(Date.now())
    }, [probePeer, setLastRefreshTs])

    const loadAndProbePeers = useCallback(async () => {
        try {
            const envPeers = getPeersFromEnvironment()
            setPeers(envPeers)
            await Promise.all(envPeers.map((host: string) => probePeer(host)))
            setLastRefreshTs(Date.now())
        } catch (e) {
            console.error('[loadAndProbePeers] Error:', e)
        }
    }, [setPeers, probePeer, setLastRefreshTs])

    useEffect(() => {
        intervalRef.current = setInterval(() => {
            probeAllPeers()
        }, AUTO_REFRESH_INTERVAL_MS)
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [probeAllPeers])

    useEffect(() => {
        loadAndProbePeers().catch((e) => console.error('[PeersView] Load error:', e))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const renderProbeStatus = (peer: PeerInfo) => {
        if (peer.isProbing) {
            return <TSDiv tag="span" className="text-xs px-2 py-1 rounded whitespace-nowrap">Probing…</TSDiv>
        }
        if (!peer.probes || peer.probes.length === 0) {
            return <TSDiv tag="span" className="text-xs px-2 py-1 rounded whitespace-nowrap">Not probed</TSDiv>
        }
        const okProbes = peer.probes.filter((p) => p.ok)
        if (okProbes.length === 0) {
            return <TSDiv
                tag="span"
                className="text-xs px-2 py-1 rounded whitespace-nowrap bg-red-100/50 text-red-600 font-semibold">Offline</TSDiv>
        }
        const latency = okProbes[0].latencyMs
        const label = peer.healthy === false ? 'Degraded' : 'Online'
        const cls = peer.healthy === false
            ? 'bg-amber-100/70 text-amber-800'
            : 'bg-green-100/50 text-green-700'
        return (
            <TSDiv tag="span"
                   className={`text-xs px-2 py-1 rounded whitespace-nowrap font-semibold ${cls}`}>
                {label} {latency != null ? `(${latency.toFixed(0)}ms)` : ''}
            </TSDiv>
        )
    }

    const handleOpenRepo = (peer: PeerInfo, repoName: string) => {
        const nodeFqdn = peer.nodeFqdn || hostnameOf(peer.host)
        const site = repoSiteOrigin(repoName, nodeFqdn)
        onOpenRepo?.(site, repoName)
    }

    const handleAddPeer = async (e: FormEvent) => {
        e.preventDefault()
        const trimmedInput = newPeerInput.trim()
        if (!trimmedInput || addBusy) return
        setAddBusy(true)
        try {
            let parsed: URL
            try {
                parsed = new URL(trimmedInput.includes('://') ? trimmedInput : `https://${trimmedInput}`)
            } catch {
                alert('Please enter a valid URL (e.g. https://dfw1.relaygateway.net or https://example.com)')
                return
            }
            const known = useAppState.getState().peers.map((p) => p.host)
            const classified = classifyAddedUrl(parsed.href, known)
            if (classified.kind === 'node') {
                addPeer(classified.origin)
                setNewPeerInput('')
                await probePeer(classified.origin)
                return
            }
            const asNode = await fetchNodeStatus(classified.origin)
            if (asNode.ok) {
                addPeer(classified.origin)
                setNewPeerInput('')
                await probePeer(classified.origin)
                return
            }
            const hook = await detectClientHookWithOptions(classified.origin)
            setNewPeerInput('')
            if (hook.ok) {
                onOpenSite?.(classified.origin)
            } else {
                onUnsupported?.(classified.origin, unsupportedMessage(hook.reason))
            }
        } finally {
            setAddBusy(false)
        }
    }

    const handleRemovePeer = (e: MouseEvent, host: string) => {
        e.stopPropagation()
        removePeer(host)
    }

    return (
        <TSDiv className="flex flex-col h-full border-r">
            <TSDiv className="p-4 border-b">
                <TSDiv className="flex items-center gap-3 mb-4">
                    <img src="/icon.png" alt="Relay" width={24} height={24} className="flex-shrink-0" />
                    <TSDiv tag="h1" className="m-0 text-xl font-semibold">Relay</TSDiv>
                </TSDiv>
                <TSDiv tag="p" className="m-0 mb-4 text-sm leading-relaxed">
                    Relay is a decentralized Web3.0 stack and social network architecture.
                    Browse git-backed repositories, CleverScript hooks, and peer gateways from this client,
                    or clone the open-source mesh from GitLab under the clevertree group.
                </TSDiv>

                <TSDiv tag="form" onSubmit={handleAddPeer} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="https://dfw1.relaygateway.net or any site with a client hook"
                        value={newPeerInput}
                        onChange={(e) => setNewPeerInput(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:border-blue-500"
                    />
                    <TSDiv
                        tag="button"
                        type="submit"
                        className="px-3 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-60"
                    >
                        {addBusy ? '…' : 'Add'}
                    </TSDiv>
                </TSDiv>
            </TSDiv>

            <TSDiv className="flex-1 overflow-y-auto flex flex-col gap-1 p-2">
                {peers.length === 0 ? (
                    <TSDiv className="flex items-center justify-center h-full p-8 text-center">
                        <TSDiv tag="p" className="m-0">No nodes configured. Add a relay node URL or set
                            RELAY_PUBLIC_MASTER_PEER_LIST.</TSDiv>
                    </TSDiv>
                ) : (
                    peers.map((peer) => (
                        <TSDiv
                            key={peer.host}
                            data-testid="node-card"
                            className="p-4 bg-white border rounded-lg transition-all"
                        >
                            <TSDiv className="flex justify-between items-center gap-4 mb-2">
                                <TSDiv className="flex items-center gap-2 flex-1 min-w-0">
                                    <TSDiv tag="span" className="font-semibold text-base truncate">{peer.host}</TSDiv>
                                    {peer.isProbing &&
                                        <TSDiv tag="span" className="inline-block text-sm animation-spin">⟳</TSDiv>}
                                </TSDiv>
                                <TSDiv className="flex items-center gap-2">
                                    {renderProbeStatus(peer)}
                                    <TSDiv
                                        tag="button"
                                        onClick={(e) => handleRemovePeer(e, peer.host)}
                                        className="px-2 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition-all"
                                        title="Remove node"
                                    >
                                        ✕
                                    </TSDiv>
                                </TSDiv>
                            </TSDiv>

                            {(peer.gatewayVersion || peer.repoCount != null) && (
                                <TSDiv className="text-xs text-gray-600 mb-2 flex flex-wrap gap-x-3 gap-y-1">
                                    {peer.gatewayVersion && <TSDiv tag="span">gateway {peer.gatewayVersion}</TSDiv>}
                                    {peer.repoCount != null && <TSDiv tag="span">{peer.repoCount} repos</TSDiv>}
                                    {peer.nodeFqdn && <TSDiv tag="span">{peer.nodeFqdn}</TSDiv>}
                                </TSDiv>
                            )}

                            {peer.statusRepos && peer.statusRepos.length > 0 ? (
                                <TSDiv className="text-sm space-y-2 mt-2">
                                    <TSDiv className="font-semibold">Repositories</TSDiv>
                                    <TSDiv className="space-y-2">
                                        {peer.statusRepos.map((repo) => (
                                            <TSDiv
                                                key={repo.name}
                                                className="flex items-center gap-2 justify-between border rounded px-2 py-1.5"
                                            >
                                                <TSDiv className="min-w-0">
                                                    <TSDiv
                                                        className="font-mono text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded w-fit">
                                                        {repo.name}
                                                    </TSDiv>
                                                    {repo.publish_sha && (
                                                        <TSDiv className="text-xs text-gray-500 mt-1">
                                                            {repo.publish_branch || 'main'}{' '}
                                                            <TSDiv tag="code">{repo.publish_sha.substring(0, 7)}</TSDiv>
                                                        </TSDiv>
                                                    )}
                                                </TSDiv>
                                                <TSDiv
                                                    tag="button"
                                                    data-testid="open-repo"
                                                    data-repo={repo.name}
                                                    className="shrink-0 px-3 py-1.5 bg-blue-500 text-white border-none rounded cursor-pointer text-sm font-medium hover:bg-blue-600 transition-colors"
                                                    onClick={() => handleOpenRepo(peer, repo.name)}
                                                >
                                                    Open →
                                                </TSDiv>
                                            </TSDiv>
                                        ))}
                                    </TSDiv>
                                </TSDiv>
                            ) : (
                                !peer.isProbing && (
                                    <TSDiv className="text-xs text-gray-500 mt-2">No repos listed (node offline or empty).</TSDiv>
                                )
                            )}
                        </TSDiv>
                    ))
                )}
            </TSDiv>
        </TSDiv>
    )
}

export function getPeersFromEnvironment(): string[] {
    let stored: string[] | null = null
    try {
        const raw = localStorage.getItem(STORAGE_KEY_PEERS)
        if (raw) {
            const peers = JSON.parse(raw) as string[]
            if (Array.isArray(peers)) stored = peers.map((p) => p.trim()).filter((p) => p.length > 0)
        }
    } catch {
        stored = null
    }

    const envPeers = import.meta?.env?.RELAY_PUBLIC_MASTER_PEER_LIST as string | undefined
    const win = window as Window & { RELAY_PUBLIC_MASTER_PEER_LIST?: string }
    const envOrWindow = envPeers || win.RELAY_PUBLIC_MASTER_PEER_LIST
    return migrateStoredPeerHosts(stored, envOrWindow)
}
