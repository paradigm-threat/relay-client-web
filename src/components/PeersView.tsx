import {useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent} from 'react'
import {type PeerInfo, STORAGE_KEY_PEERS, useAppState} from '../state/store'
import {fullProbePeer} from '../services/probing'
import {fetchNodeStatus} from '../services/nodeStatus'
import {detectClientHookWithOptions, unsupportedMessage} from '../services/hookDetect'
import {
    classifyAddedUrl,
    hostnameOf,
    migrateStoredPeerHosts,
    pickRepoMirror,
    repoSiteOrigin,
    firstReachablePeer,
    catalogRowsFromPeer,
    peerIsReachable,
    LIVE_MASTER_ORIGINS,
} from '../constants/liveFleet'
import {TSDiv} from './TSDiv'

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000

function isFleetDefaultHost (host: string): boolean {
    const hn = hostnameOf(host)
    return LIVE_MASTER_ORIGINS.some((o) => hostnameOf(o) === hn)
}

function shortNodeLabel (host: string): string {
    return hostnameOf(host).replace(/\.relaygateway\.net$/i, '')
}

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
                    reposOk: result.reposOk,
                    ipfsOk: result.ipfsOk,
                    ipfsEnabled: result.ipfsEnabled,
                    ipfsApiReachable: result.ipfsApiReachable,
                    ipfsCacheCidCount: result.ipfsCacheCidCount,
                    ipfsInFlightCount: result.ipfsInFlightCount,
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

    const renderIpfsStatus = (peer: PeerInfo) => {
        if (peer.ipfsEnabled === false) {
            return <TSDiv
                tag="span"
                className="text-xs px-2 py-1 rounded whitespace-nowrap"
                style={{ background: 'var(--status-warn-bg)', color: 'var(--status-warn-text)' }}
                title="IPFS not configured on this node"
            >IPFS off</TSDiv>
        }
        if (peer.ipfsOk === true || peer.ipfsApiReachable === true) {
            const cache = peer.ipfsCacheCidCount != null ? ` · cache ${peer.ipfsCacheCidCount}` : ''
            const inflight = peer.ipfsInFlightCount != null && peer.ipfsInFlightCount > 0
                ? ` · in-flight ${peer.ipfsInFlightCount}`
                : ''
            return <TSDiv
                tag="span"
                className="text-xs px-2 py-1 rounded whitespace-nowrap"
                style={{ background: 'var(--status-ok-bg)', color: 'var(--status-ok-text)' }}
                title="Kubo API reachable"
            >{`IPFS OK${cache}${inflight}`}</TSDiv>
        }
        if (peer.ipfsOk === false || peer.ipfsApiReachable === false) {
            return <TSDiv
                tag="span"
                className="text-xs px-2 py-1 rounded whitespace-nowrap"
                style={{ background: 'var(--status-bad-bg)', color: 'var(--status-bad-text)' }}
                title="Kubo configured but not reachable"
            >IPFS DOWN</TSDiv>
        }
        return null
    }

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
                className="text-xs px-2 py-1 rounded whitespace-nowrap font-semibold"
                style={{ background: 'var(--status-bad-bg)', color: 'var(--status-bad-text)' }}
            >Offline</TSDiv>
        }
        const latency = okProbes[0].latencyMs
        const incomplete = peer.reposOk === false
        const label = incomplete ? 'Incomplete' : 'Online'
        const style = incomplete
            ? { background: 'var(--status-warn-bg)', color: 'var(--status-warn-text)' }
            : { background: 'var(--status-ok-bg)', color: 'var(--status-ok-text)' }
        return (
            <TSDiv tag="span"
                   className="text-xs px-2 py-1 rounded whitespace-nowrap font-semibold"
                   style={style}>
                {label} {latency != null ? `(${Math.round(latency)}ms)` : ''}
            </TSDiv>
        )
    }

    const handleOpenRepo = (repoName: string) => {
        const all = useAppState.getState().peers
        const catalogPeer = firstReachablePeer(all)
        const site = pickRepoMirror(repoName, all)
            || (catalogPeer
                ? repoSiteOrigin(repoName, catalogPeer.nodeFqdn || hostnameOf(catalogPeer.host))
                : null)
        if (site) onOpenRepo?.(site, repoName)
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
                alert('Please enter a valid URL (e.g. https://iad1.relaygateway.net or https://example.com)')
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

    const catalogPeer = firstReachablePeer(peers)
    const catalogRows = catalogRowsFromPeer(catalogPeer)
    const anyProbing = peers.some((p) => p.isProbing)

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
                        placeholder="https://iad1.relaygateway.net or any site with a client hook"
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
                            <TSDiv
                                data-testid="node-card"
                                className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg transition-all"
                            >
                                <TSDiv className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                    <TSDiv>
                                        <TSDiv className="font-semibold text-base">Relay mesh</TSDiv>
                                        <TSDiv className="text-xs text-[var(--text-secondary)] mt-0.5">
                                            {catalogPeer
                                                ? <>Connected to <TSDiv tag="span" className="font-medium">{shortNodeLabel(catalogPeer.host)}</TSDiv></>
                                                : anyProbing
                                                    ? 'Probing mirrors…'
                                                    : 'No mirrors reachable'}
                                        </TSDiv>
                                    </TSDiv>
                                    {catalogPeer?.gatewayVersion && (
                                        <TSDiv className="text-xs text-[var(--text-secondary)]">
                                            gateway {catalogPeer.gatewayVersion}
                                        </TSDiv>
                                    )}
                                </TSDiv>

                                <TSDiv data-testid="mirror-status" className="flex flex-wrap gap-2 mb-4">
                                    {peers.map((peer) => {
                                        const connected = catalogPeer?.host === peer.host
                                        const reachable = peerIsReachable(peer)
                                        return (
                                            <TSDiv
                                                key={peer.host}
                                                data-testid="mirror-chip"
                                                className="flex items-center gap-1.5 border rounded px-2 py-1 text-xs"
                                                style={connected
                                                    ? { borderColor: 'var(--chip-text)', background: 'var(--chip-bg)' }
                                                    : undefined}
                                                title={peer.host}
                                            >
                                                <TSDiv tag="span" className="font-medium">{shortNodeLabel(peer.host)}</TSDiv>
                                                {renderProbeStatus(peer)}
                                                {renderIpfsStatus(peer)}
                                                {!isFleetDefaultHost(peer.host) && (
                                                    <TSDiv
                                                        tag="button"
                                                        onClick={(e) => handleRemovePeer(e, peer.host)}
                                                        className="px-1 py-0.5 bg-red-500 text-white rounded text-[10px] font-medium hover:bg-red-600"
                                                        title="Remove node"
                                                    >
                                                        ✕
                                                    </TSDiv>
                                                )}
                                                {connected && reachable && (
                                                    <TSDiv tag="span" className="text-[var(--text-secondary)]">connected</TSDiv>
                                                )}
                                            </TSDiv>
                                        )
                                    })}
                                </TSDiv>

                                {catalogRows.length > 0 ? (
                                    <TSDiv className="text-sm space-y-2">
                                        <TSDiv className="font-semibold">Repositories</TSDiv>
                                        <TSDiv className="space-y-2">
                                            {catalogRows.map((repo) => (
                                                <TSDiv
                                                    key={repo.name}
                                                    tag="button"
                                                    type="button"
                                                    data-testid="open-repo"
                                                    data-repo={repo.name}
                                                    className="w-full text-left border rounded px-3 py-2 cursor-pointer hover:border-blue-400 transition-colors"
                                                    onClick={() => handleOpenRepo(repo.name)}
                                                >
                                                    <TSDiv
                                                        className="font-mono text-xs font-semibold px-2 py-1 rounded w-fit"
                                                        style={{ background: 'var(--chip-bg)', color: 'var(--chip-text)' }}
                                                    >
                                                        {repo.name}
                                                    </TSDiv>
                                                    {repo.description && (
                                                        <TSDiv className="text-sm mt-1.5 leading-snug">
                                                            {repo.description}
                                                        </TSDiv>
                                                    )}
                                                    <TSDiv className="text-xs text-[var(--text-secondary)] mt-1">
                                                        {repo.publish_branch || 'main'}
                                                        {repo.publish_sha
                                                            ? <> <TSDiv tag="code">{repo.publish_sha.substring(0, 7)}</TSDiv></>
                                                            : repo.on_disk === false
                                                                ? ' · not mirrored yet'
                                                                : null}
                                                    </TSDiv>
                                                </TSDiv>
                                            ))}
                                        </TSDiv>
                                    </TSDiv>
                                ) : (
                                    !anyProbing && (
                                        <TSDiv className="text-xs text-[var(--text-secondary)] mt-2">
                                            No repos listed (mirrors offline or empty).
                                        </TSDiv>
                                    )
                                )}
                            </TSDiv>
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
