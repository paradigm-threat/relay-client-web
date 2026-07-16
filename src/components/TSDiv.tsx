import React from 'react'
import { TSDiv as BaseTSDiv } from '@clevertree/themed-styler'
import { unifiedBridge, styleManager } from '@clevertree/themed-styler'

type DivProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
  tag?: string
  type?: 'submit' | 'button' | 'reset'
  disabled?: boolean
}

export function TSDiv (props: DivProps): React.JSX.Element {
  return (
    <BaseTSDiv
      {...(props as React.ComponentProps<typeof BaseTSDiv>)}
      onElement={(tag, p) => {
        try {
          unifiedBridge.registerUsage(tag, p)
          styleManager.requestRender()
        } catch {
          /* registerUsage is best-effort */
        }
      }}
    />
  )
}
