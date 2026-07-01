import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { gitSignals, branchOf, crossStat } from '../lib/git.mjs'
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

test('touched paths survive unicode filenames (core.quotePath)', () => {
  const repo = mkGitRepo()
  fs.writeFileSync(path.join(repo, 'café-münü.txt'), 'x')
  const sig = gitSignals(repo)
  assert.equal(sig.dirty, true)
  assert.ok(sig.touched.includes('café-münü.txt'), `touched was: ${sig.touched}`)
  assert.ok(!sig.touched.some((p) => p.includes('\\') || p.startsWith('"')))
})

test('touched paths survive unicode filenames committed on a branch (diff path)', () => {
  const repo = mkGitRepo()
  git(repo, 'checkout', '-qb', 'feature')
  fs.writeFileSync(path.join(repo, 'naïve.ts'), 'x')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-qm', 'add naïve.ts')
  assert.ok(gitSignals(repo).touched.includes('naïve.ts'))
})

test('staged rename consumes its orig-path token (no phantom entry)', () => {
  const repo = mkGitRepo()
  git(repo, 'checkout', '-qb', 'feature')
  git(repo, 'mv', 'README.md', 'RENAMED café.md')
  const sig = gitSignals(repo)
  assert.ok(sig.touched.includes('RENAMED café.md'), `touched was: ${sig.touched}`)
  assert.ok(!sig.touched.includes('README.md'), `touched was: ${sig.touched}`)
})

test('non-git path degrades to safe defaults', () => {
  const sig = gitSignals(mkTmp('sage-norepo-'))
  assert.deepEqual(sig, { head: null, dirty: false, touched: [] })
})

test('branchOf returns the current branch', () => {
  assert.equal(branchOf(mkGitRepo()), 'main')
})

test('branchOf on a non-repo returns null', () => {
  assert.equal(branchOf(mkTmp('sage-norepo-')), null)
})

test('crossStat: numstat between two branches for a file; safe on bad input', () => {
  const repo = mkGitRepo() // on `main`, one commit
  git(repo, 'checkout', '-qb', 'feat-b')
  fs.writeFileSync(path.join(repo, 'shared.ts'), 'base line\nbranch-b line\n')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-qm', 'b edits shared')
  const stat = crossStat(repo, 'main', 'feat-b', 'shared.ts')
  assert.equal(stat.length, 1)
  assert.equal(stat[0].file, 'shared.ts')
  assert.equal(stat[0].added, 2)
  assert.equal(stat[0].deleted, 0)
  // absent file / bad ref → [] (defensive, never throws)
  assert.deepEqual(crossStat(repo, 'main', 'feat-b', 'nope.ts'), [])
  assert.deepEqual(crossStat(repo, 'bad-ref', 'also-bad', 'shared.ts'), [])
  assert.deepEqual(crossStat(mkTmp('sage-norepo-'), 'a', 'b', 'x'), [])
})
