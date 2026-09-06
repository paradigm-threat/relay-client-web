import assert from 'node:assert/strict'
import test from 'node:test'
import {
  propBoolFromVnodeProps,
  shouldInterceptRelayControlledAnchorClick,
} from '../vendor/relay-runtime-web.js'

test('propBoolFromVnodeProps reads VNode Bool prop', () => {
  assert.equal(propBoolFromVnodeProps({ relayControlled: { type: 'Bool', value: true } }, 'relayControlled'), true)
  assert.equal(propBoolFromVnodeProps({ relayControlled: { type: 'Bool', value: false } }, 'relayControlled'), false)
  assert.equal(propBoolFromVnodeProps({}, 'relayControlled'), false)
  assert.equal(propBoolFromVnodeProps(null, 'relayControlled'), false)
})

test('shouldInterceptRelayControlledAnchorClick skips modified clicks and mailto', () => {
  const el = {
    ownerDocument: { documentElement: { getAttribute: () => '1' } },
    getAttribute(name: string) {
      if (name === 'href') return './x.md'
      if (name === 'target') return null
      return null
    },
  } as unknown as HTMLElement

  const base = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }
  assert.equal(shouldInterceptRelayControlledAnchorClick(base as unknown as MouseEvent, el), true)

  assert.equal(
    shouldInterceptRelayControlledAnchorClick({ ...base, ctrlKey: true } as unknown as MouseEvent, el),
    false,
  )

  const mailtoEl = {
    ownerDocument: { documentElement: { getAttribute: () => '1' } },
    getAttribute(name: string) {
      if (name === 'href') return 'mailto:a@b.co'
      if (name === 'target') return null
      return null
    },
  } as unknown as HTMLElement
  assert.equal(shouldInterceptRelayControlledAnchorClick(base as unknown as MouseEvent, mailtoEl), false)
})

test('shouldInterceptRelayControlledAnchorClick skips absolute http(s) and pre-live', () => {
  const base = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }
  const httpsEl = {
    ownerDocument: { documentElement: { getAttribute: () => '1' } },
    getAttribute(name: string) {
      if (name === 'href') return 'https://example.com/x'
      if (name === 'target') return null
      return null
    },
  } as unknown as HTMLElement
  assert.equal(shouldInterceptRelayControlledAnchorClick(base as unknown as MouseEvent, httpsEl), false)

  const relEl = {
    ownerDocument: { documentElement: { getAttribute: () => '0' } },
    getAttribute(name: string) {
      if (name === 'href') return './x.md'
      if (name === 'target') return null
      return null
    },
  } as unknown as HTMLElement
  assert.equal(
    shouldInterceptRelayControlledAnchorClick(base as unknown as MouseEvent, relEl),
    false,
    'pre-live SSR must keep native navigation',
  )

  const liveRel = {
    ownerDocument: { documentElement: { getAttribute: () => '1' } },
    getAttribute(name: string) {
      if (name === 'href') return './x.md'
      if (name === 'target') return null
      return null
    },
  } as unknown as HTMLElement
  assert.equal(shouldInterceptRelayControlledAnchorClick(base as unknown as MouseEvent, liveRel), true)
})
