import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' })

before(() => {
  const { window } = dom
  globalThis.window = window as unknown as Window & typeof globalThis
  globalThis.document = window.document
  globalThis.DocumentFragment = window.DocumentFragment
  globalThis.HTMLElement = window.HTMLElement
  globalThis.Node = window.Node
  globalThis.Event = window.Event
})

after(() => {
  dom.window.close()
})

const {
  computeVnodePatches,
  applyVnodePatches,
  vnodeToDom,
  syncHtmlLivePhaseAttr,
  syncHtmlHydratedAttr,
} = await import('../vendor/relay-runtime-web.js')

describe('computeVnodePatches', () => {
  it('returns empty for identical trees', () => {
    const v = { Element: { tag: 'div', props: {}, children: [{ Text: 'a' }], key: null } }
    assert.equal(computeVnodePatches(v, structuredClone(v)).length, 0)
  })

  it('replaces nested text child only', () => {
    const oldV = { Element: { tag: 'div', props: {}, children: [{ Text: 'x' }], key: null } }
    const newV = { Element: { tag: 'div', props: {}, children: [{ Text: 'y' }], key: null } }
    const p = computeVnodePatches(oldV, newV)
    assert.equal(p.length, 1)
    assert.deepEqual(p[0].path, [0])
    assert.equal(p[0].tree.Text, 'y')
  })

  it('replaces element when props change with identical children', () => {
    const child = { Text: 'same' }
    const oldV = {
      Element: { tag: 'div', props: { className: 'cold' }, children: [child], key: null },
    }
    const newV = {
      Element: { tag: 'div', props: { className: 'live' }, children: [child], key: null },
    }
    const p = computeVnodePatches(oldV, newV)
    assert.equal(p.length, 1)
    assert.deepEqual(p[0].path, [])
    assert.equal(p[0].tree.Element.props.className, 'live')
  })

  it('applies nested text patch to DOM', () => {
    const oldV = { Element: { tag: 'div', props: {}, children: [{ Text: 'x' }], key: null } }
    const newV = { Element: { tag: 'div', props: {}, children: [{ Text: 'y' }], key: null } }
    const root = document.createElement('div')
    const el = vnodeToDom(oldV, () => {}, null)
    root.appendChild(el)
    const patches = computeVnodePatches(oldV, newV)
    assert.equal(applyVnodePatches(root, oldV, patches, () => {}, null), true)
    assert.equal(root.textContent, 'y')
  })
})

describe('syncHtmlLivePhaseAttr', () => {
  it('clamps phase and sets hydrated flag', () => {
    const html = document.documentElement
    syncHtmlLivePhaseAttr(0)
    assert.equal(html.getAttribute('data-pt-live-phase'), '0')
    assert.equal(html.getAttribute('data-pt-hydrated'), '0')
    syncHtmlLivePhaseAttr(3)
    assert.equal(html.getAttribute('data-pt-live-phase'), '3')
    assert.equal(html.getAttribute('data-pt-hydrated'), '1')
    syncHtmlLivePhaseAttr(99)
    assert.equal(html.getAttribute('data-pt-live-phase'), '4')
    syncHtmlHydratedAttr(false)
    assert.equal(html.getAttribute('data-pt-hydrated'), '0')
  })
})
