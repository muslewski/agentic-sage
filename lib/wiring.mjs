// lib/wiring.mjs — conservative wiring for AI agent harnesses (primarily
// ~/.claude via settings.json merge for hooks/skills; also supports Grok
// paths in harness). Both install.mjs and `sage init` call wireAll().
// wireProject() for per-repo. Grok users get value via [compat.claude] defaults
// (hooks+skills from .claude) + native .grok/hooks examples.
import fs from 'node:fs'
import path from 'node:path'
import { sageHome, globalConfig } from './paths.mjs'
import { getHarness } from './harness.mjs'
import { MARKER_DIR, explainRepoDataDir, writeRegistryEntry } from './roots.mjs'
import { resolveRepoRoot, repoIdFromRoot } from './repo-id.mjs'

const HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PostToolUse',
  'Stop',
  'PreCompact',
  'SessionEnd',
  'PreToolUse',
]

const GROK_HOOK_FILE = 'agentic-sage.json'

/**
 * Wire SAGE into a ~/.claude directory.  Idempotent and conservative.
 * @param {{ home: string, repoRoot: string, nodeExecPath?: string, skipSkill?: boolean, harness?: string, storageRoot?: string }} opts
 * @returns {{ gc, link, target, settingsPath, tmuxConf, tmuxNote, skillNote, sageBin }}
 */
export function wireAll({
  home,
  repoRoot,
  nodeExecPath = process.execPath,
  skipSkill = Boolean(process.env.SAGE_SKIP_SKILL),
  harness = 'claude',
  storageRoot,
}) {
  const profile = getHarness(harness)

  // 1. seed default-OFF global config (never clobber)
  fs.mkdirSync(sageHome(home), { recursive: true })
  const gc = globalConfig(home)
  if (!fs.existsSync(gc)) fs.writeFileSync(gc, `${JSON.stringify({ enabled: false }, null, 2)}\n`)

  // 1b. optional custom storage root — merge-don't-clobber (mirrors
  // control.mjs's setEnabled read-merge-write; never drops e.g. `enabled`).
  if (storageRoot) {
    const cur = JSON.parse(fs.readFileSync(gc, 'utf8'))
    fs.writeFileSync(gc, `${JSON.stringify({ ...cur, defaultRoot: storageRoot }, null, 2)}\n`)
  }

  // 2. symlink the emitter into <home>/.claude/hooks. Also clean up a
  // pre-rename (sage-emit.mjs) symlink left by an older install — the
  // settings rewire below removes its stale hook entry; this removes the
  // stale symlink FILE itself, but only when it's ours.
  const hooksDir = profile.hooksDir(home)
  fs.mkdirSync(hooksDir, { recursive: true })
  const link = path.join(hooksDir, 'agentic-sage-emit.mjs')
  const target = path.join(repoRoot, 'hooks', 'agentic-sage-emit.mjs')
  const staleLink = _removeStaleEmitterLink(hooksDir, repoRoot)
  _symlinkConservative(link, target)

  // 3. wire hooks.
  // Claude: merge lifecycle hooks into settings.json (throws on malformed JSON).
  // Grok: write native per-file hooks JSON under hooksDir (no settings merge).
  // Also rewires a stale old-named hook entry (see _mergeSettings) so a
  // re-init upgrade never double-fires for Claude.
  const settingsPath = profile.settings(home)
  if (profile.id === 'grok') {
    writeGrokHookFile(profile, home, link)
  } else {
    _mergeSettings(settingsPath, link, nodeExecPath, { staleLink })
  }

  // 4. tmux fleet pane
  const tmuxConf = path.join(home, '.tmux.conf')
  const sageBin = path.join(repoRoot, 'bin', 'sage')
  const tmuxNote = _wireTmux(tmuxConf, sageBin, nodeExecPath)

  // 5. symlink skills (opt-out: skipSkill or SAGE_SKIP_SKILL=1)
  const skillNote = skipSkill
    ? 'skipped (SAGE_SKIP_SKILL=1)'
    : _wireSkills(profile.skillsDir(home), repoRoot)

  return { gc, link, target, settingsPath, tmuxConf, tmuxNote, skillNote, sageBin }
}

/**
 * Wire SAGE into a single project (repo), scoped: hooks land in
 * `<mainRoot>/.claude/settings.json` (command carries `--scope=project`),
 * plus the in-repo storage marker and a central registry entry. Does NOT
 * touch tmux or global skills — minimal global mutation is the point of
 * project scope (a later global install adds those idempotently).
 *
 * Worktree safety: `projectRoot` is re-resolved to its MAIN root here — a
 * linked worktree must never grow its own `.agentic-sage/`.
 *
 * @param {{ home: string, repoRoot: string, projectRoot: string, storage?: 'repo-root'|'sibling'|'agent-home', harness?: string, nodeExecPath?: string }} opts
 * @returns {{ link, target, settingsPath, markerPath, dataDir, mainRoot, repoId }}
 */
export function wireProject({
  home,
  repoRoot,
  projectRoot,
  storage = 'repo-root',
  harness = 'claude',
  nodeExecPath = process.execPath,
}) {
  const profile = getHarness(harness)
  // Worktree safety: always resolve to the MAIN root — every write below
  // targets mainRoot, never a linked worktree's own path.
  const mainRoot = resolveRepoRoot(projectRoot) ?? projectRoot
  const repoId = repoIdFromRoot(mainRoot)

  // 1. shared emitter symlink (agent-home, idempotent — harmless even if a
  // later step throws, so it's safe to do before the settings write). Also
  // cleans up a pre-rename (sage-emit.mjs) symlink left by an older install.
  const hooksDir = profile.hooksDir(home)
  fs.mkdirSync(hooksDir, { recursive: true })
  const link = path.join(hooksDir, 'agentic-sage-emit.mjs')
  const target = path.join(repoRoot, 'hooks', 'agentic-sage-emit.mjs')
  const staleLink = _removeStaleEmitterLink(hooksDir, repoRoot)
  _symlinkConservative(link, target)

  // 2. project settings.json — throws on malformed JSON (ABORTED), same
  // merge/backup/idempotency rules as the global path. Settings-first: this
  // can throw, and it must throw BEFORE the marker/registry writes below so
  // an aborted install never half-writes project state. Also rewires a stale
  // old-named hook entry so a re-init upgrade never double-fires.
  const settingsPath = profile.projectSettings(mainRoot)
  _mergeSettings(settingsPath, link, nodeExecPath, { scopeFlag: '--scope=project', staleLink })

  // 3. storage preset → in-repo marker (merge-don't-clobber unknown keys).
  let storageRoot
  if (storage === 'sibling') {
    storageRoot = path.join(path.dirname(mainRoot), MARKER_DIR)
  } else if (storage === 'agent-home') {
    // Keep the project scope detectable in-repo (marker OR registry) even
    // though storage itself lives under the agent home.
    storageRoot = profile.storageDefault(home)
  } else if (storage !== 'repo-root') {
    throw new Error(`wireProject: unknown storage preset "${storage}"`)
  }
  const markerPath = writeMarker(mainRoot, storageRoot ? { storageRoot } : {})

  // 4. resolve dataDir via the same precedence chain the marker just fed,
  // index the registry, seed the data dir.
  const { dir: dataDir } = explainRepoDataDir({ home, mainRoot, repoId })
  writeRegistryEntry(home, repoId, { dataDir, scope: 'project', mainRoot })
  fs.mkdirSync(dataDir, { recursive: true })

  return { link, target, settingsPath, markerPath, dataDir, mainRoot, repoId }
}

/**
 * Read-merge-write the in-repo marker at `<mainRoot>/.agentic-sage/config.json`.
 * Preserves unknown keys (e.g. a future per-repo `enabled` toggle) — in
 * repo-root storage mode this file doubles as the repo's data-dir config.
 * No-ops the write when the merged content is unchanged (idempotent).
 */
export function writeMarker(mainRoot, fields = {}) {
  const markerPath = path.join(mainRoot, MARKER_DIR, 'config.json')
  fs.mkdirSync(path.dirname(markerPath), { recursive: true })
  let cur = {}
  let existing = null
  if (fs.existsSync(markerPath)) {
    existing = fs.readFileSync(markerPath, 'utf8')
    try {
      cur = JSON.parse(existing)
    } catch {
      cur = {}
    }
  }
  const next = { ...cur, ...fields }
  const nextStr = `${JSON.stringify(next, null, 2)}\n`
  if (existing !== nextStr) fs.writeFileSync(markerPath, nextStr)
  return markerPath
}

/**
 * Format the wireAll result into the human-readable install summary.
 */
export function formatResult({
  gc,
  link,
  target,
  settingsPath,
  tmuxConf,
  tmuxNote,
  skillNote,
  sageBin,
}) {
  return (
    `SAGE installed — DISABLED by default.\n` +
    `  config:   ${gc}\n` +
    `  hook:     ${link} -> ${target}\n` +
    `  settings: ${settingsPath} (backed up to .bak if it existed)\n` +
    `  tmux:     ${tmuxConf} — ${tmuxNote}\n` +
    `  skills:   ~/.claude/skills — ${skillNote}\n` +
    `  pointer:  paste templates/CLAUDE.snippet.md into CLAUDE.md (or templates/GROK.snippet.md into AGENTS.md) to wire sessions in\n` +
    `  verify:   run \`/sage-doctor\` (or \`${sageBin} doctor\`) to validate the wiring\n` +
    `Enable when ready:  edit ${gc} → {"enabled": true}  (or: sage on)\n` +
    `Fleet line:  add \`${sageBin} fleet\` to your session-sync tick for an always-on summary.\n` +
    `Guard:    built but OFF — arm per repo with \`sage guard add <path>\` then \`sage guard on\`\n` +
    `          (blocks edits to contested paths via exit 2; fail-open + default-OFF).`
  )
}

// ── private helpers ────────────────────────────────────────────────────────

function _symlinkConservative(link, target) {
  let stat = null
  try {
    stat = fs.lstatSync(link)
  } catch {
    /* absent */
  }
  if (stat) {
    if (stat.isSymbolicLink()) {
      if (fs.readlinkSync(link) !== target) {
        fs.unlinkSync(link)
        fs.symlinkSync(target, link)
      }
    } else {
      fs.renameSync(link, `${link}.bak`)
      fs.symlinkSync(target, link)
    }
  } else {
    fs.symlinkSync(target, link)
  }
}

function _mergeSettings(settingsPath, hookLink, nodeExecPath, { scopeFlag, staleLink } = {}) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
  let settings = {}
  if (fs.existsSync(settingsPath)) {
    const bak = `${settingsPath}.bak`
    if (!fs.existsSync(bak)) fs.copyFileSync(settingsPath, bak)
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    } catch {
      throw new Error(
        `SAGE install ABORTED: ${settingsPath} is not valid JSON. ` +
          `Fix it and re-run — no changes were made to it.`,
      )
    }
  }
  settings.hooks = settings.hooks || {}
  const command = `${JSON.stringify(nodeExecPath)} ${JSON.stringify(hookLink)}${scopeFlag ? ` ${scopeFlag}` : ''}`
  for (const ev of HOOK_EVENTS) {
    settings.hooks[ev] = settings.hooks[ev] || []
    // Rewire: drop a stale entry pointing at the OLD-named hook link so a
    // re-init upgrade never double-fires. Match the EXACT old hooks-dir path
    // (staleLink), not a bare `sage-emit` substring — a foreign hook that
    // merely mentions that token must survive untouched. Filter at the INNER
    // hook level (mirrors uninstall/uninstall.mjs) so a group bundling our
    // stale hook next to a foreign one keeps the foreign one; drop a group
    // only once WE emptied it.
    if (staleLink) {
      for (const group of settings.hooks[ev]) {
        if (!Array.isArray(group.hooks)) continue
        group.hooks = group.hooks.filter(
          (h) => !(typeof h.command === 'string' && h.command.includes(staleLink)),
        )
      }
      settings.hooks[ev] = settings.hooks[ev].filter(
        (g) => !Array.isArray(g.hooks) || g.hooks.length,
      )
    }
    const present = settings.hooks[ev].some((group) =>
      (group.hooks || []).some((h) => h.command === command),
    )
    if (!present) settings.hooks[ev].push({ hooks: [{ type: 'command', command }] })
  }
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)
}

// Grok Build reads individual JSON hook files from hooksDir — there is no
// settings.json to merge. We write a single dedicated file with the observed
// working shape (7 events, each an array containing one {hooks: [{type,command}]}).
function writeGrokHookFile(profile, home, emitterLink) {
  const dir = profile.hooksDir(home)
  fs.mkdirSync(dir, { recursive: true })
  // emitterLink is the already-created symlink path (e.g. ~/.grok/hooks/agentic-sage-emit.mjs)
  const entry = [{ hooks: [{ type: 'command', command: `node ${emitterLink}` }] }]
  const cfg = { hooks: Object.fromEntries(HOOK_EVENTS.map((ev) => [ev, entry])) }
  const file = path.join(dir, GROK_HOOK_FILE)
  const next = `${JSON.stringify(cfg, null, 2)}\n`
  let cur = null
  try {
    cur = fs.readFileSync(file, 'utf8')
  } catch {}
  if (cur === next) return // idempotent
  if (cur !== null && !fs.existsSync(`${file}.bak`)) fs.copyFileSync(file, `${file}.bak`)
  fs.writeFileSync(file, next)
}

// Remove a pre-rename (sage-emit.mjs) symlink left by an older install —
// only when it's OURS (target strictly inside repoRoot; `+ path.sep` so a
// sibling checkout sharing a name prefix is never touched). Reuses the
// insideRepo signature from uninstall/uninstall.mjs. Returns the stale link
// path regardless (the caller passes it to _mergeSettings to rewire the
// matching settings.json entry even if the symlink itself was already gone).
function _removeStaleEmitterLink(hooksDir, repoRoot) {
  const staleLink = path.join(hooksDir, 'sage-emit.mjs')
  try {
    if (
      fs.lstatSync(staleLink).isSymbolicLink() &&
      fs.readlinkSync(staleLink).startsWith(repoRoot + path.sep)
    ) {
      fs.unlinkSync(staleLink)
    }
  } catch {
    /* absent, or not ours — leave a foreign file untouched */
  }
  return staleLink
}

function _wireTmux(tmuxConf, sageBin, nodeExecPath) {
  const bindLine = `bind j display-popup -E -w 90% -h 70% '${nodeExecPath} ${sageBin} board'`
  let conf = ''
  try {
    conf = fs.readFileSync(tmuxConf, 'utf8')
  } catch {
    /* no tmux.conf yet */
  }
  if (conf.includes(`${sageBin} board`)) return `already present (skipped)`
  if (conf && !fs.existsSync(`${tmuxConf}.bak`)) fs.copyFileSync(tmuxConf, `${tmuxConf}.bak`)
  fs.appendFileSync(
    tmuxConf,
    `${conf && !conf.endsWith('\n') ? '\n' : ''}# SAGE fleet pane (bind j)\n${bindLine}\n`,
  )
  return `added \`bind j\` → run \`tmux source-file ~/.tmux.conf\` to apply`
}

function _wireSkills(skillsDir, repoRoot) {
  fs.mkdirSync(skillsDir, { recursive: true })
  const srcSkills = path.join(repoRoot, 'skills')
  let names = []
  try {
    names = fs
      .readdirSync(srcSkills, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    /* no skills dir */
  }
  const notes = []
  for (const name of names) {
    const slink = path.join(skillsDir, name)
    const starget = path.join(srcSkills, name)
    let sst = null
    try {
      sst = fs.lstatSync(slink)
    } catch {
      /* absent */
    }
    if (sst) {
      if (sst.isSymbolicLink()) {
        if (fs.readlinkSync(slink) !== starget) {
          fs.unlinkSync(slink)
          fs.symlinkSync(starget, slink)
          notes.push(`${name}: relinked`)
        } else {
          notes.push(`${name}: linked`)
        }
      } else if (fs.existsSync(`${slink}.bak`)) {
        notes.push(`${name}: left as-is (${name}.bak taken)`)
      } else {
        fs.renameSync(slink, `${slink}.bak`)
        fs.symlinkSync(starget, slink)
        notes.push(`${name}: backed up → .bak, linked`)
      }
    } else {
      fs.symlinkSync(starget, slink)
      notes.push(`${name}: linked`)
    }
  }
  return notes.length ? notes.join('; ') : 'no skills to link'
}
