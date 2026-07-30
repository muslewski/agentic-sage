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

test('default gate path never calls fetchLatest (local stamp only)', () => {
  const home = mkTmp('sage-gate-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), { enabled: false })
  stampWired(home, packageVersion())
  let calls = 0
  const c = capture()
  const code = runGate([], {
    home,
    cwd: home,
    stdout: c.stdout,
    stderr: c.stderr,
    fetchLatest: () => {
      calls++
      return '9.9.9'
    },
  })
  assert.equal(code, 0)
  assert.equal(calls, 0, 'default gate must not probe npm registry')
  assert.match(c.out(), /sage gate: ok/)
})

test('gate --check-latest opts into registry probe', () => {
  const home = mkTmp('sage-gate-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), { enabled: false })
  stampWired(home, packageVersion())
  let calls = 0
  const c = capture()
  // Force non-CI env so the injected spy is reachable (host CI would block).
  const prevCi = process.env.CI
  delete process.env.CI
  delete process.env.OFFLINE
  delete process.env.NO_NETWORK
  delete process.env.SAGE_NO_REGISTRY
  try {
    const code = runGate(['--check-latest'], {
      home,
      cwd: home,
      stdout: c.stdout,
      stderr: c.stderr,
      fetchLatest: (name) => {
        calls++
        assert.equal(name, 'agentic-sage')
        return packageVersion()
      },
    })
    assert.equal(code, 0)
    assert.equal(calls, 1, '--check-latest must invoke fetchLatest once')
  } finally {
    if (prevCi !== undefined) process.env.CI = prevCi
  }
})

test('offline/CI env blocks registry even under --check-latest', async () => {
  const { fetchRegistryLatest } = await import('../lib/package-freshness.mjs')
  let spy = 0
  const v = fetchRegistryLatest({
    env: { CI: '1' },
    fetchLatest: () => {
      spy++
      return '1.0.0'
    },
  })
  assert.equal(v, null)
  assert.equal(spy, 0)
})
