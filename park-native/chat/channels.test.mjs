/**
 * Lightweight checks for channel scoping helpers (run with node --test).
 * Mirrors ChatCommon.host.js scopedChannel / logsChannel logic.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, 'ChatCommon.host.js'), 'utf8');
const sandbox = { globalThis: {}, window: {}, document: null, localStorage: null };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.runInNewContext(src, sandbox);
const C = sandbox.__fbChat;

test('fb legacy channels', () => {
  assert.equal(C.scopedChannel('fb', 'lobby'), 'flashback');
  assert.equal(C.scopedChannel('fb', 'page', 'home'), 'page-home');
  assert.equal(C.scopedChannel('fb', 'movie', 'foo'), 'movie-foo');
  assert.equal(C.logsChannel('fb'), 'logs-fb');
});

test('ct / pt scoped', () => {
  assert.equal(C.scopedChannel('ct', 'lobby'), 'ct');
  assert.equal(C.scopedChannel('ct', 'page', 'home'), 'ct-page-home');
  assert.equal(C.scopedChannel('pt', 'doc', 'science'), 'pt-doc-science');
  assert.equal(C.logsChannel('pt'), 'logs-pt');
});
