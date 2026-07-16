import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDirectHookUrlFromPresetBase,
  normalizePresetRemoteHookBase,
} from '../config/presetRemoteHook.ts'

test('normalizePresetRemoteHookBase strips trailing slashes', () => {
  assert.equal(normalizePresetRemoteHookBase('http://localhost:3011/'), 'http://localhost:3011')
  assert.equal(
    normalizePresetRemoteHookBase('http://localhost:3011/repo///'),
    'http://localhost:3011/repo',
  )
})

test('normalizePresetRemoteHookBase rejects empty', () => {
  assert.throws(() => normalizePresetRemoteHookBase(''), /empty/)
  assert.throws(() => normalizePresetRemoteHookBase('   '), /empty/)
})

test('normalizePresetRemoteHookBase rejects relative', () => {
  assert.throws(() => normalizePresetRemoteHookBase('/only/path'), /not a valid/)
})

test('buildDirectHookUrlFromPresetBase appends default hook path', () => {
  assert.equal(
    buildDirectHookUrlFromPresetBase('http://localhost:3011'),
    'http://localhost:3011/hooks/client/get.jsx',
  )
})
