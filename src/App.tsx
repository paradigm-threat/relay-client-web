import { useCallback, useEffect, useMemo } from 'react'
import { useAppState } from './state/store'
import { PeersView } from './components/PeersView'
import { TabBar } from './components/TabBar'
import { RepoBrowser } from './components/RepoBrowser'
import { SettingsTab } from './components/SettingsTab'
import { TestTab } from './components/TestTab'
import { PluginProvider } from './plugins/PluginContext'
import { createWebPlugin } from './plugins/web'
import { TSDiv } from './components/TSDiv'
import { SpaHistoryListener } from './components/SpaHistoryListener'
import { applySiteNavigation } from './navigation/siteNavigation'
import {
  locationFromTab,
  pushShellLocation,
} from './navigation/shellHistory'

const filesMirrorBase =
  typeof import.meta.env !== 'undefined' && import.meta.env.RELAY_PUBLIC_FILES_BASE
    ? String(import.meta.env.RELAY_PUBLIC_FILES_BASE).replace(/\/$/, '')
    : ''

function App () {
  const onNavigate = useCallback((path: string, opts?: { replace?: boolean }) => {
    applySiteNavigation(path, opts)
  }, [])

  const webPlugin = useMemo(
    () =>
      createWebPlugin({
        baseUrl: filesMirrorBase,
        onNavigate,
      }),
    [onNavigate]
  )

  const activeTabId = useAppState((s) => s.activeTabId)
  const openTab = useAppState((s) => s.openTab)
  const openUnsupportedTab = useAppState((s) => s.openUnsupportedTab)
  const siteView = useAppState((s) => s.siteView)

  const handleOpenRepo = (siteOrigin: string, repo: string) => {
    const id = openTab(siteOrigin, '/', { repo, title: repo })
    const tab = useAppState.getState().tabs.find((t) => t.id === id)
    if (tab) pushShellLocation(locationFromTab(tab))
  }

  const handleOpenSite = (origin: string) => {
    const id = openTab(origin, '/', { title: origin })
    const tab = useAppState.getState().tabs.find((t) => t.id === id)
    if (tab) pushShellLocation(locationFromTab(tab))
  }

  const handleUnsupported = (url: string, reason: string) => {
    openUnsupportedTab(url, reason)
  }

  const activeIsRepo = Boolean(
    activeTabId && activeTabId !== 'home' && activeTabId !== 'settings' && activeTabId !== 'test',
  )

  useEffect(() => {
    if (siteView) {
      document.documentElement.dataset.relaySiteView = '1'
    } else {
      delete document.documentElement.dataset.relaySiteView
    }
  }, [siteView])

  return (
    <PluginProvider plugin={webPlugin}>
      <SpaHistoryListener />
      <TSDiv
        className="flex flex-col w-screen h-screen"
        style={{ background: 'var(--bg)', color: 'var(--text)' }}
      >
        {!siteView && (
          <TSDiv data-testid="shell-chrome">
            <TabBar />
          </TSDiv>
        )}
        <TSDiv className="flex flex-1 overflow-hidden">
          <TSDiv tag='main' className="flex-1 flex flex-col overflow-hidden">
            {!siteView && activeTabId === 'home' && (
              <PeersView
                onOpenRepo={handleOpenRepo}
                onOpenSite={handleOpenSite}
                onUnsupported={handleUnsupported}
              />
            )}
            {!siteView && activeTabId === 'settings' && <SettingsTab />}
            {!siteView && activeTabId === 'test' && <TestTab />}
            {activeIsRepo && activeTabId ? <RepoBrowser tabId={activeTabId} /> : null}
            {!siteView && !activeTabId && (
              <TSDiv className="flex items-center justify-center h-full w-full">
                <TSDiv className="text-center">
                  <TSDiv tag='h2' className="mb-2 text-2xl font-semibold">No repositories open</TSDiv>
                  <TSDiv tag='p' className="text-base">Select a repository from the home tab.</TSDiv>
                </TSDiv>
              </TSDiv>
            )}
          </TSDiv>
        </TSDiv>
      </TSDiv>
    </PluginProvider>
  )
}

export default App
