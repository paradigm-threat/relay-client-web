import assert from 'node:assert/strict'
import { mock, test, before, after } from 'node:test'
import { JSDOM } from 'jsdom'

const spa = new JSDOM('<!DOCTYPE html><html class="dark"><head></head><body></body></html>', {
  url: 'http://localhost:5173/',
})
const iframe = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  url: 'about:blank',
})

before(() => {
  globalThis.window = spa.window as unknown as Window & typeof globalThis
  globalThis.document = spa.window.document
  globalThis.ShadowRoot = spa.window.ShadowRoot
})

after(() => {
  spa.window.close()
  iframe.window.close()
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

const {
  styleParentFor,
  themeTargetFor,
  ensureStyleElement,
  syncHtmlHydratedAttr,
} = await import('../vendor/relay-runtime-web.js')

test('styleParentFor uses iframe head, not the SPA document.head', () => {
  const mount = iframe.window.document.createElement('div')
  iframe.window.document.body.appendChild(mount)
  const parent = styleParentFor(mount)
  assert.equal(parent, iframe.window.document.head)
  assert.notEqual(parent, spa.window.document.head)
})

test('themeTargetFor and syncHtmlHydratedAttr target iframe <html>', () => {
  const mount = iframe.window.document.createElement('div')
  iframe.window.document.body.appendChild(mount)
  const target = themeTargetFor(mount)
  assert.equal(target, iframe.window.document.documentElement)
  assert.notEqual(target, spa.window.document.documentElement)

  syncHtmlHydratedAttr(true, mount)
  assert.equal(iframe.window.document.documentElement.getAttribute('data-pt-hydrated'), '1')
  assert.equal(spa.window.document.documentElement.hasAttribute('data-pt-hydrated'), false)
})

test('ensureStyleElement does not reuse SPA #relay-ssr-theme', () => {
  const spaStyle = spa.window.document.createElement('style')
  spaStyle.id = 'relay-ssr-theme'
  spaStyle.textContent = '/* spa leftover */'
  spa.window.document.head.appendChild(spaStyle)

  const mount = iframe.window.document.createElement('div')
  iframe.window.document.body.appendChild(mount)
  const el = ensureStyleElement('relay-ssr-theme', styleParentFor(mount))
  assert.ok(el)
  assert.equal(el?.ownerDocument, iframe.window.document)
  assert.equal(el?.parentNode, iframe.window.document.head)
  assert.equal(spaStyle.parentNode, spa.window.document.head)
  assert.equal(spaStyle.textContent, '/* spa leftover */')
})
