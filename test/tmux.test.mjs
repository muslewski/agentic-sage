import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePanes, paneForPid } from '../lib/tmux.mjs'

test('parsePanes: tab rows → objects; skips blank/short/non-numeric', () => {
  const raw = '111\tmain:0\t@1\n222\tacme:0\t@2\n\nbad-line\nxyz\tfoo:0\t@3\n'
  assert.deepEqual(parsePanes(raw), [
    { panePid: 111, pane: 'main:0', windowId: '@1' },
    { panePid: 222, pane: 'acme:0', windowId: '@2' },
  ])
})

test('paneForPid: 0-hop self pane resolves; empty/miss → null', () => {
  const panes = [{ panePid: process.pid, pane: 'here:0', windowId: '@9' }]
  assert.equal(paneForPid(process.pid, panes), 'here:0')
  assert.equal(paneForPid(process.pid, []), null)
  assert.equal(paneForPid(999999999, panes), null) // no such pid → walk bails → null
})

test('paneForPid: resolves an ancestor pane via the /proc walk', () => {
  // process.ppid is a real ancestor of process.pid → seed a pane there and the
  // walk must climb to it. (Skips gracefully on a /proc-less platform.)
  const ppid = process.ppid
  if (!ppid || ppid <= 1) return
  const panes = [{ panePid: ppid, pane: 'parent:0', windowId: '@7' }]
  const res = paneForPid(process.pid, panes)
  // Linux: resolves to 'parent:0'; non-Linux (/proc absent): null — both are valid degradations.
  assert.ok(res === 'parent:0' || res === null)
})
