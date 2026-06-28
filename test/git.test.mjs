import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { gitSignals } from '../lib/git.mjs'
import { mkTmp, mkGitRepo, git } from './helpers.mjs'

test('clean repo on main: head set, not dirty, nothing touched', () => {
  const repo = mkGitRepo()
  const sig = gitSignals(repo)
  assert.match(sig.head, /^[0-9a-f]{40}$/)
  assert.equal(sig.dirty, false)
  assert.deepEqual(sig.touched, [])
})

test('an untracked file makes the repo dirty', () => {
  const repo = mkGitRepo()
  fs.writeFileSync(path.join(repo, 'scratch.txt'), 'x')
  assert.equal(gitSignals(repo).dirty, true)
})

test('a branch commit shows in touched (vs main)', () => {
  const repo = mkGitRepo()
  git(repo, 'checkout', '-qb', 'feature')
  fs.writeFileSync(path.join(repo, 'newfile.txt'), 'x')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-qm', 'add newfile')
  assert.ok(gitSignals(repo).touched.includes('newfile.txt'))
})

test('non-git path degrades to safe defaults', () => {
  const sig = gitSignals(mkTmp('sage-norepo-'))
  assert.deepEqual(sig, { head: null, dirty: false, touched: [] })
})
