import React, { useState } from 'react'
import { setCurrentTheme, getCurrentTheme, isClientLive } from '@clevertree/style-internal'

function resolveTheme() {
  const stored = getCurrentTheme()
  if (stored === 'dark' || stored === 'light') return stored
  return 'light'
}

/**
 * Tiny hook for local SSR hydration e2e.
 * Theme label reads relay-runtime getCurrentTheme after setCurrentTheme.
 */
export default function SsrHydrateDemo() {
  const live = isClientLive() === true
  const [count, setCount] = useState(0)
  const theme = resolveTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <div className="ssr-hydrate-demo demo-box" id="ssr-hydrate-demo">
      <h1>SSR Hydrate Demo</h1>
      <p id="ssr-static-line">Static content for no-JS browsers</p>
      <span id="ssr-count">Count: {count}</span>
      <button type="button" id="ssr-increment" disabled={!live} onClick={() => setCount(count + 1)}>
        Increment
      </button>
      <button
        type="button"
        id="ssr-theme-toggle"
        disabled={!live}
        dataTheme={next}
        onClick={() => {
          if (!live) return
          setCurrentTheme(next)
        }}
      >
        Theme: {theme}
      </button>
    </div>
  )
}
