/**
 * relay-client-web — universal Relay shell (react-router-style tabs + relay-runtime WASM).
 */

import './assets/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import PresetRemoteShell from './PresetRemoteShell'
import { resolvePresetRemoteHook } from './config/presetRemoteHook'
import { useAppState } from './state/store'
import { installShellThemeBridge } from './shellThemeBridgeSync'

const rootEl = document.getElementById('root')
if (rootEl) {
  const preset = resolvePresetRemoteHook()
  if (preset.kind === 'ok') {
    useAppState.getState().initPresetRemoteHookSession(preset.base)
  }
  installShellThemeBridge()
  createRoot(rootEl).render(
    <StrictMode>
      {preset.kind === 'none' ? <App /> : <PresetRemoteShell resolution={preset} />}
    </StrictMode>,
  )
}
