import React, { useState } from 'react'

/**
 * Tiny hook for local SSR hydration e2e.
 * First paint must match embed-ssr.html markup (tag structure).
 * Avoid hyphenated JSX attrs (CleverScript parser treats `data-x` as subtraction).
 */
export default function SsrHydrateDemo() {
  const [count, setCount] = useState(0)
  return (
    <div className="ssr-hydrate-demo" id="ssr-hydrate-demo">
      <h1>SSR Hydrate Demo</h1>
      <p id="ssr-static-line">Static content for no-JS browsers</p>
      <span id="ssr-count">Count: {count}</span>
      <button type="button" id="ssr-increment" onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  )
}
