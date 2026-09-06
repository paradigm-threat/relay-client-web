import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { JSDOM } from 'jsdom'

const dom = new JSDOM(
  '<!DOCTYPE html><html><body><div id="root" data-relay-ssr="1"></div></body></html>',
  { url: 'http://localhost/' },
)

before(() => {
  const { window } = dom
  globalThis.window = window as unknown as Window & typeof globalThis
  globalThis.document = window.document
  globalThis.DocumentFragment = window.DocumentFragment
  globalThis.HTMLElement = window.HTMLElement
  globalThis.Node = window.Node
  globalThis.Event = window.Event
  globalThis.CSS = { escape: (s: string) => s } as typeof CSS
})

after(() => {
  dom.window.close()
})

const {
  hydrateVnode,
  promoteSsrShellWithoutWipe,
  replaceSsrPlaceholdersFromVnode,
  vnodeToDom,
} = await import('../vendor/relay-runtime-web.js')

describe('soft hydrateVnode', () => {
  it('keeps absolute anchors when child counts diverge', () => {
    const root = document.getElementById('root')!
    root.innerHTML =
      '<div class="shell"><header><a href="https://example.com/search">Search</a></header>' +
      '<main><p>one</p><p>two</p></main></div>'
    const search = root.querySelector('a[href="https://example.com/search"]')
    assert.ok(search)

    // VNode has extra main children vs DOM — previously hard-failed hydrate.
    const vnode = {
      Element: {
        tag: 'div',
        props: { className: 'shell' },
        key: null,
        children: [
          {
            Element: {
              tag: 'header',
              props: {},
              key: null,
              children: [
                {
                  Element: {
                    tag: 'a',
                    props: { href: 'https://example.com/search' },
                    key: null,
                    children: [{ Text: 'Search' }],
                  },
                },
              ],
            },
          },
          {
            Element: {
              tag: 'main',
              props: {},
              key: null,
              children: [
                { Element: { tag: 'p', props: {}, key: null, children: [{ Text: 'one' }] } },
                { Element: { tag: 'p', props: {}, key: null, children: [{ Text: 'two' }] } },
                { Element: { tag: 'p', props: {}, key: null, children: [{ Text: 'three' }] } },
                { Element: { tag: 'section', props: {}, key: null, children: [] } },
              ],
            },
          },
        ],
      },
    }

    const ok = hydrateVnode(vnode, root, () => {}, null)
    assert.equal(ok, true)
    assert.ok(document.contains(search))
    assert.equal(
      root.querySelector('a[href="https://example.com/search"]')?.textContent,
      'Search',
    )
  })
})

describe('promoteSsrShellWithoutWipe', () => {
  it('sets hydrated attrs without clearing SSR links', () => {
    const root = document.getElementById('root')!
    root.innerHTML = '<a href="https://example.com/home">Home</a>'
    root.dataset.relaySsr = '1'
    promoteSsrShellWithoutWipe(root, { hydrateOk: true })
    assert.equal(root.dataset.relayHydrated, '1')
    assert.equal(document.documentElement.getAttribute('data-pt-hydrated'), '1')
    assert.equal(document.documentElement.getAttribute('data-pt-live-phase'), '1')
    assert.equal(root.querySelector('a')?.getAttribute('href'), 'https://example.com/home')
    assert.equal(root.innerHTML.includes('Home'), true)
  })
})

describe('replaceSsrPlaceholdersFromVnode', () => {
  it('replaces dirnav placeholder without wiping siblings', () => {
    const root = document.getElementById('root')!
    root.innerHTML =
      '<a href="https://example.com/x">Keep</a>' +
      '<aside class="pt-dir-nav" aria-label="Directory" data-pt-dirnav-ssr="1">' +
      '<p>Directory loads after page open…</p></aside>'

    const vnode = {
      Element: {
        tag: 'div',
        props: {},
        key: null,
        children: [
          {
            Element: {
              tag: 'a',
              props: { href: 'https://example.com/x' },
              key: null,
              children: [{ Text: 'Keep' }],
            },
          },
          {
            Element: {
              tag: 'aside',
              props: { className: 'pt-dir-nav', 'aria-label': 'Directory' },
              key: null,
              children: [
                {
                  Element: {
                    tag: 'ul',
                    props: {},
                    key: null,
                    children: [
                      {
                        Element: {
                          tag: 'li',
                          props: {},
                          key: null,
                          children: [{ Text: 'blog' }],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    }

    const replaced = replaceSsrPlaceholdersFromVnode(root, vnode, () => {}, null)
    assert.equal(replaced, true)
    assert.equal(root.querySelector('a')?.textContent, 'Keep')
    assert.equal(root.querySelector('[data-pt-dirnav-ssr]'), null)
    assert.match(root.querySelector('.pt-dir-nav')?.textContent || '', /blog/)
  })
})

describe('vnodeToDom smoke', () => {
  it('builds a simple element', () => {
    const el = vnodeToDom(
      { Element: { tag: 'p', props: {}, key: null, children: [{ Text: 'hi' }] } },
      () => {},
      null,
    )
    assert.equal(el?.textContent, 'hi')
  })
})
