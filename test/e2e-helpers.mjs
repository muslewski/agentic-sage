import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkTmp, writeGlobalConfig } from './helpers.mjs'
import { sessionFile, eventsFile } from '../lib/paths.mjs'

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const EMITTER = path.join(REPO_ROOT, 'hooks', 'agentic-sage-emit.mjs')

export const EMITTER_PATH = EMITTER

// Sandbox $HOME with SAGE globally enabled (default-OFF otherwise).
// Reuses writeGlobalConfig from test/helpers to match existing test patterns.
export const mkSandboxHome = () => {
  const home = mkTmp()
  writeGlobalConfig(home, { enabled: true })
  return { home }
}

// Drive the emitter exactly like a harness does: JSON on stdin, env vars set.
// Uses spawnSync so caller can inspect .status even on 0 (emitter is always 0).
export const emit = (home, payload, env = {}) => {
  return spawnSync(process.execPath, [EMITTER], {
    input: JSON.stringify(payload),
    env: { ...process.env, HOME: home, ...env },
    encoding: 'utf8',
    timeout: 15_000,
  })
}

export const readSession = (home, repoId, sid) => {
  try {
    return JSON.parse(fs.readFileSync(sessionFile(home, repoId, sid), 'utf8'))
  } catch {
    return null
  }
}

export const eventsFor = (home, repoId) => {
  try {
    return fs
      .readFileSync(eventsFile(home, repoId), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  } catch {
    return []
  }
}
