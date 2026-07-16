/// <reference types="react" />
/// <reference types="react-dom" />

interface ImportMetaEnv {
  readonly RELAY_PUBLIC_FILES_BASE?: string
  readonly RELAY_PUBLIC_MASTER_PEER_LIST?: string
  readonly RELAY_PUBLIC_DISABLE_VIDEO?: string
  /** Base URL for preset fullscreen remote hook mode (default path /hooks/client/get.jsx). */
  readonly RELAY_PUBLIC_PRESET_REMOTE_HOOK?: string
  readonly DEV?: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
