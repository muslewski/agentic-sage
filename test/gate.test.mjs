import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mkTmp } from './helpers.mjs'
import { globalConfig, sageHome } from '../lib/paths.mjs'
import { atomicWriteJson } from '../lib/store.mjs'
import { stampWired, packageVersion } from '../lib/install-state.mjs'
import { runGate } from '../lib/gate.mjs'

const capture = () => {
  const out = []
  const err = []
  return {
    stdout: { write: (s) => out.push(String(s)) },
    stderr: { write: (s) => err.push(String(s)) },
    out: () => out.join(''),
    err: () => err.join(''),
  }
}

test('gate ok when wired matches installed and optional desire', () => {
  const home = mkTmp('sage-gate-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), { enabled: true })
  stampWired(home, packageVersion())
  const c = capture()
  const code = runGate([], {
    home,
    cwd: home,
    stdout: c.stdout,
    stderr: c.stderr,
    fetchLatest: () => packageVersion(),
  })
  assert.equal(code, 0)
  assert.match(c.out(), /sage gate: ok/)
})

test('gate soft-warns preferred offline without failing', () => {
  const home = mkTmp('sage-gate-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), {
    enabled: true,
    judge: { desired: 'preferred' },
  })
  stampWired(home, packageVersion())
  const c = capture()
  const code = runGate([], {
    home,
    cwd: home,
    stdout: c.stdout,
    stderr: c.stderr,
    fetchLatest: () => packageVersion(),
  })
  assert.equal(code, 0)
  assert.match(c.out(), /live judge preferred/)
})

test('gate --strict fails on wired lag, not preferred offline', () => {
  const home = mkTmp('sage-gate-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), {
    enabled: true,
    judge: { desired: 'preferred' },
  })
  stampWired(home, '0.0.1')
  const c = capture()
  const code = runGate(['--strict'], {
    home,
    cwd: home,
    stdout: c.stdout,
    stderr: c.stderr,
    fetchLatest: () => packageVersion(),
  })
  assert.equal(code, 1)
  assert.match(c.out(), /wired 0\.0\.1|installed/)
})

test('preferred offline alone never fails strict when wired ok', () => {
  const home = mkTmp('sage-gate-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), {
    enabled: true,
    judge: { desired: 'preferred' },
  })
  stampWired(home, packageVersion())
  const c = capture()
  const code = runGate(['--strict'], {
    home,
    cwd: home,
    stdout: c.stdout,
    stderr: c.stderr,
    fetchLatest: () => packageVersion(),
  })
  assert.equal(code, 0, 'preferred offline must stay soft under --strict')
  assert.match(c.out(), /preferred/)
})
