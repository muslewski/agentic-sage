/**
 * `sage gate` — soft control-plane check (install freshness + preferred judge).
 * Preferred-offline is always soft (exit 0). --strict may fail on freshness only.
 * Default path is local-only (wired stamp). Registry/npm probe requires
 * `--check-latest` (or config packageFreshness.registry=true).
 */
import fs from 'node:fs'
import os from 'node:os'
import { computePackageFreshness, shouldExitNonZero } from './package-freshness.mjs'
import { evaluateJudgeDesire, preferredOfflineLine } from './judge-desired.mjs'
import { resolveRepoId } from './repo-id.mjs'
import { readEnabled } from './control.mjs'
import { sageHome } from './paths.mjs'

/**
 * @param {string[]} argv
 * @param {{
 *   home?: string,
 *   cwd?: string,
 *   stdout?: { write: Function },
 *   stderr?: { write: Function },
 *   fetchLatest?: (name: string) => string | null,
 *   forceRegistry?: boolean,
 *   checkLatest?: boolean,
 *   now?: number,
 * }} [opts]
 * @returns {number}
 */
export function runGate(argv, opts = {}) {
  const home = opts.home ?? os.homedir()
  const cwd = opts.cwd ?? process.cwd()
  const stdout = opts.stdout ?? process.stdout
  const stderr = opts.stderr ?? process.stderr
  const strict = Array.isArray(argv) && argv.includes('--strict')
  const checkLatest =
    opts.checkLatest === true || (Array.isArray(argv) && argv.includes('--check-latest'))
  const forceRegistry =
    opts.forceRegistry === true || (Array.isArray(argv) && argv.includes('--force'))
  const now = opts.now ?? Date.now()

  try {
    const messages = []

    // Install home present?
    const homeDir = sageHome(home)
    if (!fs.existsSync(homeDir)) {
      messages.push('sage gate: sage home missing — run: sage init')
      if (strict) {
        for (const m of messages) stdout.write(`${m}\n`)
        stderr.write('sage gate: fail (strict) — install/wire incomplete\n')
        return 1
      }
    }

    const freshness = computePackageFreshness(home, {
      checkLatest,
      forceRegistry,
      fetchLatest: opts.fetchLatest,
      now,
      // Tests (and rare callers) may inject env to exercise offline/CI probes
      // without mutating process.env. Production leaves this undefined → process.env.
      env: opts.env,
    })
    messages.push(...freshness.messages)

    // Preferred live judge — always soft
    if (readEnabled(home)) {
      const repoId = resolveRepoId(cwd)
      const desire = evaluateJudgeDesire(home, { now, repoId })
      if (desire.shouldWarn) {
        messages.push(`sage: ${preferredOfflineLine()}`)
      }
    }

    if (messages.length === 0) {
      stdout.write('sage gate: ok\n')
      return 0
    }

    for (const msg of messages) {
      stdout.write(`${msg}\n`)
    }

    // Preferred-offline must never cause non-zero; only freshness/wiring.
    if (shouldExitNonZero(freshness, strict)) {
      stderr.write(
        strict
          ? 'sage gate: fail (strict) — resolve install freshness before continuing\n'
          : 'sage gate: fail — set packageFreshness.mode to "warn" for soft-only\n',
      )
      return 1
    }

    return 0
  } catch (err) {
    if (strict) {
      stderr.write(`sage gate: error: ${err?.message ?? err}\n`)
      return 1
    }
    return 0
  }
}
