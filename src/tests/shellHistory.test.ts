import assert from 'node:assert/strict'
import test from 'node:test'
import {
  locationFromTab,
  parseShellLocation,
  shellLocationHref,
  viewLocationFromTab,
} from '../navigation/shellHistory.ts'

test('parse home / settings / test', () => {
  assert.equal(parseShellLocation('').kind, 'home')
  assert.equal(parseShellLocation('?t=settings').kind, 'settings')
  assert.equal(parseShellLocation('?t=test').kind, 'test')
})

test('parse repo and view keep host and path', () => {
  const repo = parseShellLocation('?repo=files&host=https://files.dfw1.relaygateway.net&p=/about')
  assert.equal(repo.kind, 'repo')
  if (repo.kind === 'repo') {
    assert.equal(repo.repo, 'files')
    assert.equal(repo.host, 'https://files.dfw1.relaygateway.net')
    assert.equal(repo.path, '/about')
  }
  const view = parseShellLocation('?view=files&host=https://files.lon1.relaygateway.net')
  assert.equal(view.kind, 'view')
  if (view.kind === 'view') {
    assert.equal(view.repo, 'files')
    assert.equal(view.host, 'https://files.lon1.relaygateway.net')
  }
})

test('href round-trips without inventing a pathname (keeps Vercel 404s)', () => {
  assert.equal(shellLocationHref({ kind: 'home' }), '/')
  assert.equal(shellLocationHref({ kind: 'settings' }), '/?t=settings')
  assert.equal(
    shellLocationHref({ kind: 'repo', repo: 'files', host: 'https://files.dfw1.relaygateway.net' }),
    '/?repo=files&host=https%3A%2F%2Ffiles.dfw1.relaygateway.net',
  )
  assert.equal(shellLocationHref({ kind: 'view', repo: 'files' }), '/?view=files')
})

test('tab helpers', () => {
  assert.equal(locationFromTab({ id: 'home' }).kind, 'home')
  const repo = locationFromTab({ id: 'tab-1', repo: 'files', host: 'https://x', path: '/' })
  assert.equal(repo.kind, 'repo')
  const view = viewLocationFromTab({ repo: 'files', host: 'https://x' })
  assert.equal(view.kind, 'view')
  assert.equal(view.repo, 'files')
})
