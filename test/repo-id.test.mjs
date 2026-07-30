import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  repoIdFromRoot,
  resolveRepoId,
  resolveRepoRoot,
  resolveRepo,
  resolveWorktreeRoot,
} from '../lib/repo-id.mjs'
import { mkTmp, mkGitRepo, git } from './helpers.mjs'

test('repoIdFromRoot is slug-shaped and deterministic', () => {
  const a = repoIdFromRoot('/a/b/acme')
  assert.match(a, /^acme-[0-9a-f]{8}$/)
  assert.equal(a, repoIdFromRoot('/a/b/acme'))
})

test('a worktree resolves to the same id as its main checkout', () => {
  const main = mkGitRepo()
  const wt = path.join(mkTmp('sage-wtp-'), 'wt') // must not pre-exist
  git(main, 'worktree', 'add', '-q', wt, '-b', 'wtbranch')
  assert.equal(resolveRepoId(main), resolveRepoId(wt))
})

test('non-git path resolves to null', () => {
  const notRepo = mkTmp('sage-norepo-')
  fs.writeFileSync(path.join(notRepo, 'x'), 'x')
  assert.equal(resolveRepoId(notRepo), null)
})

test('resolveRepo returns { root, id, worktree } consistent with the individual resolvers', () => {
  const repo = mkGitRepo()
  const result = resolveRepo(repo)
  assert.equal(result.root, resolveRepoRoot(repo))
  assert.equal(result.id, resolveRepoId(repo))
  assert.equal(result.worktree, resolveWorktreeRoot(repo))
})

test('resolveRepo on a non-repo temp dir returns null', () => {
  assert.equal(resolveRepo(mkTmp('sage-norepo-')), null)
})

test('nested worktree has same repo id but distinct worktree path', () => {
  const main = mkGitRepo()
  const wt = path.join(mkTmp('sage-wtp-'), 'wt')
  git(main, 'worktree', 'add', '-q', wt, '-b', 'wtbranch')
  const a = resolveRepo(main)
  const b = resolveRepo(wt)
  assert.equal(a.id, b.id)
  assert.equal(a.root, b.root)
  assert.notEqual(a.worktree, b.worktree)
  assert.equal(b.worktree, fs.realpathSync(wt))
})

test('relocated gitdir does not use dirname of common dir as root', () => {
  // Simulate: gitdir outside the worktree (file-form .git → absolute gitdir).
  const main = mkGitRepo()
  const realGit = path.join(main, '.git')
  const relocated = path.join(mkTmp('sage-gitdir-'), 'relocated.git')
  fs.renameSync(realGit, relocated)
  fs.writeFileSync(path.join(main, '.git'), `gitdir: ${relocated}\n`)
  // Point common dir's config so git still works
  const root = resolveRepoRoot(main)
  // Must NOT be the parent of relocated (a random tmp dir basename)
  assert.notEqual(root, path.dirname(relocated))
  // Identity is the common dir realpath when not named ".git"
  assert.equal(root, fs.realpathSync(relocated))
  // Worktree root is still the checkout
  assert.equal(resolveWorktreeRoot(main), fs.realpathSync(main))
  assert.equal(resolveRepoId(main), repoIdFromRoot(root))
})
