import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyDefaultClientGetHook,
  DEFAULT_CLIENT_GET_HOOK_REPO_PATH,
  repoRelativeHookPathToUrlPath,
} from '../constants/relayClientDefaults.ts'

test('applyDefaultClientGetHook fills missing get path', () => {
  const o = applyDefaultClientGetHook({ ok: true })
  assert.equal(o.client?.hooks?.get?.path, DEFAULT_CLIENT_GET_HOOK_REPO_PATH)
})

test('applyDefaultClientGetHook preserves explicit path', () => {
  const o = applyDefaultClientGetHook({
    client: { hooks: { get: { path: 'hooks/client/custom.jsx' } } },
  })
  assert.equal(o.client?.hooks?.get?.path, 'hooks/client/custom.jsx')
})

test('repoRelativeHookPathToUrlPath', () => {
  assert.equal(repoRelativeHookPathToUrlPath('hooks/client/get.jsx'), '/hooks/client/get.jsx')
  assert.equal(repoRelativeHookPathToUrlPath('/hooks/client/get.jsx'), '/hooks/client/get.jsx')
})
