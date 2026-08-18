import React from 'react'
import { useAppState } from '../state/store'
import { TSDiv } from './TSDiv'
import {
  locationFromTab,
  pushShellLocation,
  viewLocationFromTab,
} from '../navigation/shellHistory'

interface TabBarProps {
  onTabChange?: (tabId: string) => void
}

export function TabBar({ onTabChange }: TabBarProps) {
  const tabs = useAppState((s) => s.tabs)
  const activeTabId = useAppState((s) => s.activeTabId)
  const setActiveTab = useAppState((s) => s.setActiveTab)
  const closeTab = useAppState((s) => s.closeTab)
  const setSiteView = useAppState((s) => s.setSiteView)
  const shellTheme = useAppState((s) => s.shellTheme)
  const setShellTheme = useAppState((s) => s.setShellTheme)

  if (tabs.length === 0) return null

  const handleTabClick = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId)
    setActiveTab(tabId)
    if (tab) pushShellLocation(locationFromTab(tab))
    onTabChange?.(tabId)
  }

  const handleCloseTab = (event: React.MouseEvent<HTMLElement>, tabId: string) => {
    event.stopPropagation()
    closeTab(tabId)
    const next = useAppState.getState()
    const tab = next.tabs.find((t) => t.id === next.activeTabId)
    if (tab) pushShellLocation(locationFromTab(tab))
  }

  const handleFullscreen = (event: React.MouseEvent<HTMLElement>, tabId: string) => {
    event.stopPropagation()
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab || tab.isHome || tab.id === 'settings' || tab.id === 'test' || tab.unsupported) return
    setActiveTab(tabId)
    setSiteView(true)
    pushShellLocation(viewLocationFromTab(tab))
  }

  return (
    <TSDiv className="border-b border-[var(--border)] bg-[var(--bg)] overflow-x-auto overflow-y-hidden">
      <TSDiv className="flex gap-1 p-0 min-h-11 items-center">
        <TSDiv className="flex gap-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const canFullscreen = !tab.isHome && tab.id !== 'settings' && tab.id !== 'test' && !tab.unsupported
            return (
              <TSDiv
                key={tab.id}
                className={`flex items-center gap-2 px-4 py-2 border border-b-2 rounded-t-lg cursor-pointer transition-all flex-shrink-0 min-w-32 max-w-60 ${isActive
                  ? 'border-b-blue-500 font-semibold bg-[var(--bg-surface)]'
                  : 'border-b-transparent'
                  }`}
                onClick={() => handleTabClick(tab.id)}
              >
                <TSDiv
                  tag="span"
                  className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[var(--text)]"
                  title={tab.title}
                >
                  {tab.title}
                </TSDiv>
                {canFullscreen && (
                  <TSDiv
                    tag="button"
                    data-testid="tab-fullscreen"
                    onClick={(event: React.MouseEvent<HTMLElement>) => handleFullscreen(event, tab.id)}
                    className="border-none bg-transparent text-sm cursor-pointer text-[var(--text-secondary)] p-0 w-6 h-6 flex items-center justify-center rounded transition-all flex-shrink-0"
                    aria-label="Full screen"
                    title="Open site without client chrome (Back returns here)"
                  >
                    ⛶
                  </TSDiv>
                )}
                {!tab.isHome && tab.id !== 'settings' && (
                  <TSDiv
                    tag="button"
                    onClick={(event: React.MouseEvent<HTMLElement>) => handleCloseTab(event, tab.id)}
                    className="border-none bg-transparent text-xl cursor-pointer text-[var(--text-secondary)] p-0 w-6 h-6 flex items-center justify-center rounded transition-all flex-shrink-0"
                    aria-label="Close tab"
                  >
                    ×
                  </TSDiv>
                )}
              </TSDiv>
            )
          })}
        </TSDiv>
        <TSDiv className="ml-auto flex items-center gap-1 pr-2">
          {(['system', 'light', 'dark'] as const).map((key) => {
            const active = shellTheme === key
            const label = key === 'system' ? 'System' : key === 'light' ? 'Light' : 'Dark'
            return (
              <TSDiv
                key={key}
                tag="button"
                type="button"
                data-testid={`chrome-theme-${key}`}
                onClick={() => setShellTheme(key)}
                className={`px-2 py-1 text-xs rounded border ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-transparent text-[var(--text-secondary)] border-[var(--border)]'
                }`}
                aria-pressed={active}
                title={`${label} theme`}
              >
                {label}
              </TSDiv>
            )
          })}
        </TSDiv>
      </TSDiv>
    </TSDiv>
  )
}
