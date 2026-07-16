import { useCallback, useMemo } from 'react'
import { RepoBrowser } from './components/RepoBrowser'
import { PluginProvider } from './plugins/PluginContext'
import { createWebPlugin } from './plugins/web'
import { applySiteNavigation } from './navigation/siteNavigation'
import { PRESET_REMOTE_TAB_ID, type PresetRemoteHookResolution } from './config/presetRemoteHook'

const filesMirrorBase =
  typeof import.meta.env !== 'undefined' && import.meta.env.RELAY_PUBLIC_FILES_BASE
    ? String(import.meta.env.RELAY_PUBLIC_FILES_BASE).replace(/\/$/, '')
    : ''

type PresetRemoteShellProps = {
  resolution: Exclude<PresetRemoteHookResolution, { kind: 'none' }>
}

/**
 * Fullscreen remote hook host (no TabBar / Home / Settings / Test).
 * Preset session is initialized in main.tsx before first paint when `resolution.kind === 'ok'`.
 */
export default function PresetRemoteShell ({ resolution }: PresetRemoteShellProps) {
  const onNavigate = useCallback((path: string, opts?: { replace?: boolean }) => {
    applySiteNavigation(path, opts)
  }, [])

  const webPlugin = useMemo(
    () =>
      createWebPlugin({
        baseUrl: filesMirrorBase,
        onNavigate,
      }),
    [onNavigate],
  )

  if (resolution.kind === 'invalid') {
    return (
      <div data-testid="relay-preset-remote-invalid" className="p-6 text-sm text-red-700 bg-red-50 min-h-screen">
        <p className="font-semibold">Invalid preset remote hook URL</p>
        <p className="mt-2 font-mono break-all">{resolution.raw}</p>
        <p className="mt-2">{resolution.message}</p>
      </div>
    )
  }

  return (
    <PluginProvider plugin={webPlugin}>
      <div data-testid="relay-preset-remote-app" className="flex flex-col h-screen min-h-0 w-full">
        <RepoBrowser tabId={PRESET_REMOTE_TAB_ID} />
      </div>
    </PluginProvider>
  )
}
