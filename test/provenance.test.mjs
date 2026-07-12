import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAgent, classifyParent } from '../lib/provenance.mjs'

// injected readers: process tree is a { childPid: parentPid } map
const tree = (map) => (pid) => map[pid] ?? 0

test('SAGE_PARENT tag → nested with parent sid (deterministic)', () => {
  const r = classifyParent({ pid: 500, env: { SAGE_PARENT: 'advisor-sid-9' }, panes: [] })
  assert.deepEqual(r, { managed_by: 'nested', parent_sid: 'advisor-sid-9', via: 'tag' })
})

test('tree: reaches a tmux pane with no agent above → human', () => {
  const r = classifyParent({
    pid: 200, env: {}, panes: [{ panePid: 100, pane: 's:0' }],
    ppidOf: tree({ 200: 100, 100: 1 }), isAgent: () => false,
  })
  assert.equal(r.managed_by, 'human')
  assert.equal(r.via, 'tree')
})

test('tree: own agent then a SECOND agent above → nested (spawned by an agent)', () => {
  const r = classifyParent({
    pid: 200, env: {}, panes: [{ panePid: 100, pane: 's:0' }],
    // 200 = the session's own agent, 150 = the launcher/advisor agent above it, 100 = pane
    ppidOf: tree({ 200: 150, 150: 100, 100: 1 }),
    isAgent: (p) => p === 200 || p === 150,
  })
  assert.equal(r.managed_by, 'nested')
  assert.equal(r.via, 'tree')
})

test('tree: a shell wraps the hook; own agent then a pane → human', () => {
  const r = classifyParent({
    pid: 200, env: {}, panes: [{ panePid: 100, pane: 's:0' }],
    // 200 = wrapping shell (not an agent), 180 = own agent, 100 = pane
    ppidOf: tree({ 200: 180, 180: 100, 100: 1 }),
    isAgent: (p) => p === 180,
  })
  assert.equal(r.managed_by, 'human')
  assert.equal(r.via, 'tree')
})

test('tree: pane check wins on the same hop even if that pid is also an agent', () => {
  const r = classifyParent({
    pid: 200, env: {}, panes: [{ panePid: 100, pane: 's:0' }],
    ppidOf: tree({ 200: 100 }), isAgent: () => true,
  })
  assert.equal(r.managed_by, 'human') // pane hit before agent check
})

test('headless: chain reaches init with no pane → nested', () => {
  const r = classifyParent({
    pid: 200, env: {}, panes: [{ panePid: 999, pane: 's:0' }],
    ppidOf: tree({ 200: 1 }), isAgent: () => false,
  })
  assert.deepEqual(r, { managed_by: 'nested', parent_sid: null, via: 'headless' })
})

test('isAgent: claude/grok comm true; armory cmdline true; plain node false', () => {
  const comm = (m) => (p) => m[p] ?? ''
  const cmd = (m) => (p) => m[p] ?? ''
  assert.equal(isAgent(1, { commOf: comm({ 1: 'claude' }), cmdlineOf: cmd({}) }), true)
  assert.equal(isAgent(2, { commOf: comm({ 2: 'grok' }), cmdlineOf: cmd({}) }), true)
  assert.equal(
    isAgent(3, { commOf: comm({ 3: 'node' }), cmdlineOf: cmd({ 3: '/usr/bin/node /home/u/llm-armory/bin/armory grok-xhigh' }) }),
    true,
  )
  assert.equal(isAgent(4, { commOf: comm({ 4: 'node' }), cmdlineOf: cmd({ 4: '/usr/bin/node server.js' }) }), false)
  assert.equal(isAgent(5, { commOf: comm({ 5: 'zsh' }), cmdlineOf: cmd({ 5: '-zsh' }) }), false)
})
