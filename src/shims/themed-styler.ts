/**
 * Dev shim: replace with `npm link @clevertree/themed-styler` when the workspace package is available.
 */
import React from 'react'

export const unifiedBridge = {
  setCurrentTheme (_name: string) {},
  registerUsage (_tag: string, _props: Record<string, unknown>) {},
  getThemeList: (): Array<{ key: string; name: string }> => [],
  getUsageSnapshot: (): { selectors: string[]; classes: string[] } => ({ selectors: [], classes: [] }),
  getCssForWeb: () => '',
  getThemes: () => ({}) as Record<string, unknown>,
}

export const styleManager = {
  requestRender () {},
  onChange: (cb: () => void) => {
    void cb
    return () => {}
  },
  state: undefined as unknown,
}

export async function initThemedStyler (): Promise<void> {}

type TSDivProps = React.HTMLAttributes<HTMLElement> & {
  tag?: string
  disabled?: boolean
  onElement?: (tag: string, props: Record<string, unknown>) => void
  children?: React.ReactNode
}

export function TSDiv ({ tag = 'div', onElement: _onElement, children, ...rest }: TSDivProps) {
  return React.createElement(tag, rest, children)
}
