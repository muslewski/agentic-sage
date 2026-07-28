import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  SESSION_START_SOFT_MAX,
  formatSageSoftLine,
  selectSessionStartSoftLines,
} from '../lib/session-start-soft.mjs'
import { wiredLagSoftLine, evaluateWiredLag } from '../lib/package-freshness.mjs'
import { preferredOfflineLine } from '../lib/judge-desired.mjs'
import { stampWired } from '../lib/install-state.mjs'
import { sageHome, globalConfig } from '../lib/paths.mjs'
import { atomicWriteJson } from '../lib/store.mjs'
import { mkTmp } from './helpers.mjs'

test('formatSageSoftLine prefixes sage: once', () => {
  assert.equal(formatSageSoftLine(''), '')
  assert.equal(formatSageSoftLine(null), '')
  assert.equal(formatSageSoftLine('  hello  '), 'sage: hello')
  assert.equal(formatSageSoftLine('sage: already'), 'sage: already')
})

test('selectSessionStartSoftLines: priority preferred > fleet > freshness, max 2', () => {
  assert.equal(SESSION_START_SOFT_MAX, 2)
  const preferred = preferredOfflineLine()
  const fleet = '2 live · nearest feat-x touches src/a.ts'
  const fresh = 'agentic-sage 1.3.0 installed, wired 1.2.0'

  assert.deepEqual(selectSessionStartSoftLines([preferred, fleet, fresh]), [
    `sage: ${preferred}`,
    `sage: ${fleet}`,
  ])
  assert.deepEqual(selectSessionStartSoftLines(['', fleet, fresh]), [
    `sage: ${fleet}`,
    `sage: ${fresh}`,
  ])
  assert.deepEqual(selectSessionStartSoftLines([preferred, '', fresh]), [
    `sage: ${preferred}`,
    `sage: ${fresh}`,
  ])
  assert.deepEqual(selectSessionStartSoftLines(['', '', fresh]), [`sage: ${fresh}`])
  assert.deepEqual(selectSessionStartSoftLines([null, null, null]), [])
  assert.deepEqual(selectSessionStartSoftLines([preferred, fleet, fresh], 1), [
    `sage: ${preferred}`,
  ])
  assert.deepEqual(selectSessionStartSoftLines([preferred, fleet, fresh], 0), [])
})

test('evaluateWiredLag / wiredLagSoftLine: only when stamp lags installed', () => {
  const lag = evaluateWiredLag({ wiredVersion: '1.0.0' }, '1.2.0')
  assert.equal(lag.lag, true)
  assert.match(lag.messages[0], /1\.2\.0 installed, wired 1\.0\.0/)
  assert.equal(evaluateWiredLag(null, '1.2.0').lag, false)
  assert.equal(evaluateWiredLag({ wiredVersion: '1.2.0' }, '1.2.0').lag, false)
  assert.equal(
    wiredLagSoftLine('/nope', {
      installed: '1.2.0',
      state: { wiredVersion: '1.0.0' },
      globalConfig: {},
    }),
    lag.messages[0],
  )
  assert.equal(
    wiredLagSoftLine('/nope', {
      installed: '1.2.0',
      state: { wiredVersion: '1.2.0' },
      globalConfig: {},
    }),
    null,
  )
  assert.equal(
    wiredLagSoftLine('/nope', {
      installed: '1.2.0',
      state: { wiredVersion: '1.0.0' },
      globalConfig: { packageFreshness: { wired: false } },
    }),
    null,
  )
})

test('wiredLagSoftLine never throws on corrupt state', () => {
  const home = mkTmp('sage-soft-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  fs.writeFileSync(`${sageHome(home)}/state.json`, '{not json')
  assert.equal(wiredLagSoftLine(home, { installed: '9.9.9' }), null)
})

test('wiredLagSoftLine reads real state.json stamp', () => {
  const home = mkTmp('sage-soft-')
  fs.mkdirSync(sageHome(home), { recursive: true })
  atomicWriteJson(globalConfig(home), { enabled: true })
  stampWired(home, '0.0.1')
  const line = wiredLagSoftLine(home, { installed: '1.3.0' })
  assert.match(line, /wired 0\.0\.1/)
  assert.match(line, /1\.3\.0/)
})
