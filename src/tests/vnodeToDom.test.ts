import assert from 'node:assert/strict'
import { mock, test, before, after } from 'node:test'
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

mock.module('../wasm/relay_runtime_pkg/relay_runtime.js', {
  defaultExport: async () => {},
  namedExports: {
    run_hook_with_host: () => null,
    get_injected_css: () => '',
    get_themes: () => '{}',
    set_theme_and_render: () => {},
    push_message_from_host: () => {},
    invoke_handler: () => {},
    consume_render_requested: () => false,
    set_client_live: () => {},
    is_client_live: () => false,
    get_current_theme_name: () => '',
  },
})

const { vnodeToDom, hydrateVnode } = await import('../vendor/relay-runtime-web.js')

const sampleVNode = {
  Element: {
    tag: 'div',
    props: {
      id: { type: 'String', value: 'layout' },
      style: {
        type: 'Style',
        value: {
          display: 'flex',
          flexDirection: 'column',
          paddingTop: '8px',
        },
      },
    },
    children: [
      { Text: 'File:' },
      {
        Element: {
          tag: 'button',
          props: {
            type: { type: 'String', value: 'button' },
            onClick: { type: 'HandlerId', value: 42 },
          },
          children: [{ Text: 'Up' }],
        },
      },
    ],
  },
}

test('vnodeToDom builds DOM tree from VNode JSON', () => {
  const root = vnodeToDom(sampleVNode, () => {})
  assert.ok(root)
  assert.equal(root instanceof dom.window.HTMLElement, true)
  const el = root as HTMLElement
  assert.equal(el.tagName.toLowerCase(), 'div')
  assert.equal(el.id, 'layout')
  const btn = el.querySelector('button')
  assert.ok(btn)
  assert.equal(btn?.textContent, 'Up')
})

test('vnodeToDom applies inline Style props', () => {
  const root = vnodeToDom(sampleVNode, () => {}) as HTMLElement
  assert.equal(root.style.display, 'flex')
  assert.equal(root.style.flexDirection, 'column')
  assert.equal(root.style.paddingTop, '8px')
})

test('vnodeToDom adds pixels to numeric dimensional styles', () => {
  const vnode = {
    Element: {
      tag: 'div',
      props: {
        style: {
          type: 'Style',
          value: {
            borderLeftWidth: '2',
            width: 96,
            opacity: '0.5',
            lineHeight: '1.6',
            margin: '0',
          },
        },
      },
      children: [],
    },
  }
  const root = vnodeToDom(vnode, () => {}) as HTMLElement
  assert.equal(root.style.borderLeftWidth, '2px')
  assert.equal(root.style.width, '96px')
  assert.equal(root.style.opacity, '0.5')
  assert.equal(root.style.lineHeight, '1.6')
  assert.equal(root.style.margin, '0px')
})

test('vnodeToDom button click calls mock invokeHandler', () => {
  const invoked: number[] = []
  const root = vnodeToDom(sampleVNode, (id: number) => {
    invoked.push(id)
  }) as HTMLElement
  const btn = root.querySelector('button')
  assert.ok(btn)
  btn!.click()
  assert.deepEqual(invoked, [42])
})

test('hydrateVnode attaches handlers onto SSR markup', () => {
  const container = document.createElement('div')
  container.innerHTML =
    '<div id="layout"><button type="button">Up</button></div>'
  // Text node "File:" is omitted from SSR for this test; hydrate walks elements only.
  const vnode = {
    Element: {
      tag: 'div',
      props: {
        id: { type: 'String', value: 'layout' },
      },
      children: [
        {
          Element: {
            tag: 'button',
            props: {
              type: { type: 'String', value: 'button' },
              onClick: { type: 'HandlerId', value: 7 },
            },
            children: [{ Text: 'Up' }],
          },
        },
      ],
    },
  }
  const invoked: number[] = []
  const ok = hydrateVnode(vnode, container, (id: number) => {
    invoked.push(id)
  })
  assert.equal(ok, true)
  const btn = container.querySelector('button')
  assert.ok(btn)
  btn!.click()
  assert.deepEqual(invoked, [7])
})

test('hydrateVnode returns false on tag mismatch', () => {
  const container = document.createElement('div')
  container.innerHTML = '<span>x</span>'
  const vnode = {
    Element: {
      tag: 'div',
      props: {},
      children: [{ Text: 'x' }],
    },
  }
  assert.equal(hydrateVnode(vnode, container, () => {}), false)
})

test('vnodeToDom creates SVG in the SVG namespace with numeric size attrs', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const vnode = {
    Element: {
      tag: 'svg',
      props: {
        width: { type: 'Number', value: 20 },
        height: { type: 'Number', value: 20 },
        viewBox: { type: 'String', value: '0 0 24 24' },
        fill: { type: 'String', value: 'none' },
        stroke: { type: 'String', value: 'currentColor' },
      },
      children: [
        {
          Element: {
            tag: 'path',
            props: {
              d: { type: 'String', value: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' },
            },
            children: [],
          },
        },
      ],
    },
  }
  const svg = vnodeToDom(vnode, () => {}) as SVGElement
  assert.equal(svg.namespaceURI, SVG_NS)
  assert.equal(svg.getAttribute('width'), '20')
  assert.equal(svg.getAttribute('height'), '20')
  assert.equal(svg.getAttribute('viewBox'), '0 0 24 24')
  const path = svg.querySelector('path')
  assert.ok(path)
  assert.equal(path!.namespaceURI, SVG_NS)
})
