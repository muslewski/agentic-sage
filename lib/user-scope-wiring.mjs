// lib/user-scope-wiring.mjs — read-only inspection of fragile user-scope
// agent wiring under <home>/.claude (hooks, skills, settings.json commands).
// Never repairs, moves, or deletes anything. Fail-open: missing dirs,
// unreadable files, and malformed JSON yield findings or a skip note — never
// throw into the doctor path.
import fs from 'node:fs'
import path from 'node:path'
import { resolveRepoRoot as defaultResolveRepoRoot } from './repo-id.mjs'

/** @typedef {'dangling'|'worktree'|'nvm-pinned'|'wired-missing'|'settings-malformed'|'no-claude'} Kind */
/** @typedef {'broken'|'warn'|'info'} Severity */
/**
 * @typedef {{
 *   kind: Kind,
 *   severity: Severity,
 *   path: string,
 *   target?: string,
 *   detail: string,
 *   fix: string,
 * }} Finding
 */

const FIX_REWIRE =
  'repoint the symlink to a stable checkout or package path (not a worktree / nvm version), or run: sage init --repair from the main repo'
const FIX_DANGLING =
  'remove the dangling link or repoint it: rm <path>  then  sage init --repair from a stable install'
const FIX_WIRED =
  'create the missing file, fix the path in settings.json, or run: sage init --repair'
const FIX_SETTINGS =
  'fix or restore ~/.claude/settings.json (invalid JSON — doctor skipped hook-command scan)'

/**
 * Inspect <home>/.claude for fragile wiring. Never throws.
 * @param {string} home  — synthetic or real HOME (respects test overrides)
 * @returns {{ findings: Finding[], note?: string }}
 */
export function inspectUserScopeWiring(home) {
  /** @type {Finding[]} */
  const findings = []
  const claude = path.join(home, '.claude')

  if (!existsDir(claude)) {
    return {
      findings: [],
      note: 'no ~/.claude — skip user-scope wiring scan',
    }
  }

  // Symlinks under hooks/ and skills/ (and one level of skill subdirs is not needed —
  // skill entries are themselves the symlinks install creates).
  for (const sub of ['hooks', 'skills']) {
    const dir = path.join(claude, sub)
    scanSymlinkDir(dir, findings)
  }

  // settings.json — wired commands that do not resolve.
  const settingsPath = path.join(claude, 'settings.json')
  if (existsAny(settingsPath)) {
    let settings
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    } catch {
      findings.push({
        kind: 'settings-malformed',
        severity: 'warn',
        path: settingsPath,
        detail: `settings.json unreadable or malformed (${settingsPath})`,
        fix: FIX_SETTINGS,
      })
      return { findings }
    }
    scanSettingsCommands(settings, home, findings)
  }

  return { findings }
}

/**
 * Turn inspection results into doctor check rows.
 * Broken findings → ok:false + severity broken (✗).
 * Latent risks (worktree / nvm that still resolve) → ok:false + severity warn (⚠).
 * Clean / skip → single ok:true row.
 * @param {string} home
 * @returns {Array<{name:string,ok:boolean,detail:string,fix?:string,severity?:string}>}
 */
export function userScopeWiringChecks(home) {
  let result
  try {
    result = inspectUserScopeWiring(home)
  } catch {
    return [
      {
        name: 'user-scope wiring',
        ok: true,
        detail: 'scan skipped (unexpected error — fail-open)',
      },
    ]
  }

  const { findings, note } = result
  if (note && findings.length === 0) {
    return [{ name: 'user-scope wiring', ok: true, detail: note }]
  }
  if (findings.length === 0) {
    return [{ name: 'user-scope wiring', ok: true, detail: 'clean' }]
  }

  return findings.map((f) => ({
    name: `user-scope ${f.kind}`,
    ok: false,
    severity: f.severity,
    detail: f.detail,
    fix: f.fix,
  }))
}

// ── scanners ────────────────────────────────────────────────────────────────

function scanSymlinkDir(dir, findings) {
  let names
  try {
    names = fs.readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    const p = path.join(dir, name)
    let st
    try {
      st = fs.lstatSync(p)
    } catch {
      continue
    }
    if (!st.isSymbolicLink()) continue
    classifySymlink(p, findings)
  }
}

function classifySymlink(linkPath, findings) {
  let target
  try {
    target = fs.readlinkSync(linkPath)
  } catch {
    return
  }
  // Resolve relative link targets against the link's directory.
  const absTarget = path.isAbsolute(target) ? target : path.resolve(path.dirname(linkPath), target)

  let targetExists = false
  try {
    fs.statSync(absTarget) // follows one more hop if needed for "exists"
    targetExists = true
  } catch {
    targetExists = false
  }

  if (!targetExists) {
    pushUnique(findings, {
      kind: 'dangling',
      severity: 'broken',
      path: linkPath,
      target: absTarget,
      detail: `dangling symlink ${linkPath} → ${absTarget}`,
      fix: FIX_DANGLING,
    })
    return // dangling wins over latent-risk labels for the same path
  }

  if (isWorktreePath(absTarget)) {
    pushUnique(findings, {
      kind: 'worktree',
      severity: 'warn',
      path: linkPath,
      target: absTarget,
      detail: `worktree-targeted ${linkPath} → ${absTarget}`,
      fix: FIX_REWIRE,
    })
  }

  if (isNvmPinnedPath(absTarget)) {
    pushUnique(findings, {
      kind: 'nvm-pinned',
      severity: 'warn',
      path: linkPath,
      target: absTarget,
      detail: `nvm-pinned ${linkPath} → ${absTarget}`,
      fix: FIX_REWIRE,
    })
  }
}

function scanSettingsCommands(settings, home, findings) {
  const hooks = settings?.hooks
  if (!hooks || typeof hooks !== 'object') return

  for (const ev of Object.keys(hooks)) {
    const groups = hooks[ev]
    if (!Array.isArray(groups)) continue
    for (const grp of groups) {
      const list = grp?.hooks
      if (!Array.isArray(list)) continue
      for (const h of list) {
        if (typeof h?.command !== 'string') continue
        for (const raw of extractCommandPaths(h.command)) {
          const resolved = expandHome(raw, home)
          if (!pathLooksLikeFileRef(resolved)) continue
          if (!existsAny(resolved)) {
            pushUnique(findings, {
              kind: 'wired-missing',
              severity: 'broken',
              path: resolved,
              detail: `wired-but-missing command path ${resolved}`,
              fix: FIX_WIRED,
            })
            continue
          }
          // Latent: command path exists but is nvm-pinned or worktree-hosted.
          if (isWorktreePath(resolved)) {
            pushUnique(findings, {
              kind: 'worktree',
              severity: 'warn',
              path: resolved,
              detail: `worktree-targeted command path ${resolved}`,
              fix: FIX_REWIRE,
            })
          }
          if (isNvmPinnedPath(resolved)) {
            pushUnique(findings, {
              kind: 'nvm-pinned',
              severity: 'warn',
              path: resolved,
              detail: `nvm-pinned command path ${resolved}`,
              fix: FIX_REWIRE,
            })
          }
        }
      }
    }
  }
}

// ── path classifiers ────────────────────────────────────────────────────────

/** True when path contains a worktrees/ segment (fragile by construction). */
export function isWorktreePath(p) {
  if (typeof p !== 'string' || !p) return false
  const norm = p.replace(/\\/g, '/')
  return /(^|\/)\.claude\/worktrees\//.test(norm) || /(^|\/)worktrees\//.test(norm)
}

/** True when path lives under .nvm/versions/node/<ver>/. */
export function isNvmPinnedPath(p) {
  if (typeof p !== 'string' || !p) return false
  const norm = p.replace(/\\/g, '/')
  return /(^|\/)\.nvm\/versions\/node\//.test(norm)
}

/**
 * Stabilize a package/checkout root for install wiring: prefer the main git
 * root when `repoRoot` is a linked worktree (so hooks/skills never point at a
 * tree that `git worktree remove` will delete).
 * @param {string} repoRoot
 * @param {{ resolveRepoRoot?: (cwd: string) => string|null }} [deps]
 * @returns {string}
 */
export function stabilizePackageRoot(repoRoot, deps = {}) {
  let abs = repoRoot
  try {
    abs = fs.realpathSync(repoRoot)
  } catch {
    /* keep as given */
  }

  const resolve = deps.resolveRepoRoot || defaultResolveRepoRoot

  try {
    const main = resolve(abs)
    if (main && main !== abs) {
      const emitter = path.join(main, 'hooks', 'agentic-sage-emit.mjs')
      if (existsAny(emitter)) return main
    }
  } catch {
    /* fall through */
  }

  // Heuristic fallback (no git / tests): strip .claude/worktrees/<name>.
  const norm = abs.replace(/\\/g, '/')
  const m = norm.match(/^(.*)\/\.claude\/worktrees\/[^/]+(.*)$/)
  if (m) {
    const candidate = m[1] + (m[2] || '')
    const emitter = path.join(candidate, 'hooks', 'agentic-sage-emit.mjs')
    if (existsAny(emitter)) return candidate
    if (existsDir(candidate)) return candidate
  }

  return abs
}

// ── token helpers ───────────────────────────────────────────────────────────

/** Extract absolute / home-relative path-like tokens from a hook command string. */
export function extractCommandPaths(command) {
  if (typeof command !== 'string' || !command) return []
  const out = []
  // Quoted strings first, then bare tokens that look like paths.
  const re = /"([^"]+)"|'([^']+)'|(\S+)/g
  let m
  while ((m = re.exec(command)) !== null) {
    const tok = m[1] ?? m[2] ?? m[3]
    if (!tok) continue
    if (tok.startsWith('-')) continue // flags
    if (tok.includes('/') || tok.startsWith('~')) out.push(tok)
  }
  return out
}

function expandHome(p, home) {
  if (p === '~') return home
  if (p.startsWith('~/') || p.startsWith('~' + path.sep)) return path.join(home, p.slice(2))
  return p
}

function pathLooksLikeFileRef(p) {
  // Skip bare commands like "node" without a slash.
  return p.includes('/') || p.includes(path.sep) || p.startsWith('~')
}

function existsDir(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function existsAny(p) {
  try {
    fs.statSync(p)
    return true
  } catch {
    return false
  }
}

function pushUnique(findings, f) {
  const key = `${f.kind}\0${f.path}`
  if (findings.some((x) => `${x.kind}\0${x.path}` === key)) return
  findings.push(f)
}
