// Storage-root resolution: where a repo's data (config.json, sessions/,
// events.ndjson, guard.json) lives. Independent of install scope (where the
// emitter hook is wired — see lib/wiring.mjs). Precedence, first hit wins:
//   0. env.SAGE_STORAGE_ROOT           — power-user / test override (a ROOT)
//   1. in-repo marker <mainRoot>/.agentic-sage/config.json
//        - storageRoot set  → <storageRoot>/repos/<id>
//        - no storageRoot   → <mainRoot>/.agentic-sage itself (repo-root mode)
//      (only checkable when mainRoot is known — id-only callers skip this)
//   2. central registry <sageHome>/registry.json → repos[id].dataDir
//   3. global config defaultRoot       → <defaultRoot>/repos/<id>
//   4. built-in default                → <home>/.claude/sage/repos/<id>
//   5. legacy fallback                 — deferred (plan 011)
// All file reads fail open: any parse/fs error falls through to the next
// rule, so a corrupt marker or registry never throws into a hook's hot path.
// No import from ./paths.mjs or ./store.mjs — paths.mjs imports THIS module,
// so importing either back would cycle. readJson/atomic write are
// reimplemented locally here (same reason lib/enabled.mjs does).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { repoIdFromRoot } from './repo-id.mjs'

export const MARKER_DIR = '.agentic-sage'

export const sageHome = (home = os.homedir()) => path.join(home, '.claude', 'sage')

export const registryPath = (home) => path.join(sageHome(home), 'registry.json')

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

const atomicWriteJson = (file, obj) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp.${crypto.randomBytes(6).toString('hex')}`
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2))
  fs.renameSync(tmp, file)
  return obj
}

// Fail-open read: any missing/corrupt registry ⇒ empty registry, never throws.
export const readRegistry = (home) => {
  const r = readJson(registryPath(home))
  return r && typeof r === 'object' && r.repos ? r : { repos: {} }
}

export const writeRegistryEntry = (home, repoId, entry) => {
  const current = readRegistry(home)
  const next = { ...current, repos: { ...current.repos, [repoId]: entry } }
  return atomicWriteJson(registryPath(home), next)
}

// Expand a leading `~/` against the injected `home` (not the real OS home).
const expandTilde = (p, home) => (p?.startsWith('~/') ? path.join(home, p.slice(2)) : p)

// Read the in-repo marker at <mainRoot>/.agentic-sage/config.json. Fail-open:
// any fs/parse error ⇒ null (caller falls through to the next rule).
const readMarker = (mainRoot) => {
  const file = path.join(mainRoot, MARKER_DIR, 'config.json')
  return readJson(file)
}

// Fail-open read of the global config's defaultRoot key.
const readDefaultRoot = (home) => {
  const g = readJson(path.join(sageHome(home), 'config.json'))
  return g && typeof g.defaultRoot === 'string' ? g.defaultRoot : null
}

// Implements the full precedence chain and explains which rule fired.
export const explainRepoDataDir = ({
  home = os.homedir(),
  mainRoot,
  repoId,
  env = process.env,
}) => {
  const id = repoId || (mainRoot ? repoIdFromRoot(mainRoot) : undefined)

  // Rule 0: env override.
  const envRoot = env?.SAGE_STORAGE_ROOT
  if (envRoot) {
    const root = expandTilde(envRoot, home)
    return { dir: path.join(root, 'repos', id), rule: 'env', scope: 'global' }
  }

  // Rule 1: in-repo marker (only checkable with a known mainRoot).
  if (mainRoot) {
    const marker = readMarker(mainRoot)
    if (marker) {
      if (typeof marker.storageRoot === 'string') {
        const root = expandTilde(marker.storageRoot, home)
        return { dir: path.join(root, 'repos', id), rule: 'marker', scope: 'project' }
      }
      return { dir: path.join(mainRoot, MARKER_DIR), rule: 'marker', scope: 'project' }
    }
  }

  // Rule 2: central registry.
  if (id) {
    const registry = readRegistry(home)
    const entry = registry.repos?.[id]
    if (entry && typeof entry.dataDir === 'string') {
      return {
        dir: entry.dataDir,
        rule: 'registry',
        scope: entry.scope === 'project' ? 'project' : 'global',
      }
    }
  }

  // Rule 3: global config defaultRoot.
  const defaultRoot = readDefaultRoot(home)
  if (defaultRoot) {
    const root = expandTilde(defaultRoot, home)
    return { dir: path.join(root, 'repos', id), rule: 'default-root', scope: 'global' }
  }

  // Rule 4: built-in default.
  return { dir: path.join(sageHome(home), 'repos', id), rule: 'built-in', scope: 'global' }
}

export const resolveRepoDataDir = (opts) => explainRepoDataDir(opts).dir
