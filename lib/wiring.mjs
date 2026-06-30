// lib/wiring.mjs — conservative ~/.claude wiring, injectable for tests.
// Both install.mjs and `sage init` call wireAll().
import fs from 'node:fs'
import path from 'node:path'
import { sageHome, globalConfig } from './paths.mjs'

const HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PostToolUse',
  'Stop',
  'PreCompact',
  'SessionEnd',
  'PreToolUse',
]

/**
 * Wire SAGE into a ~/.claude directory.  Idempotent and conservative.
 * @param {{ home: string, repoRoot: string, nodeExecPath?: string, skipSkill?: boolean }} opts
 * @returns {{ gc, link, target, settingsPath, tmuxConf, tmuxNote, skillNote, sageBin }}
 */
export function wireAll({
  home,
  repoRoot,
  nodeExecPath = process.execPath,
  skipSkill = Boolean(process.env.SAGE_SKIP_SKILL),
}) {
  // 1. seed default-OFF global config (never clobber)
  fs.mkdirSync(sageHome(home), { recursive: true })
  const gc = globalConfig(home)
  if (!fs.existsSync(gc)) fs.writeFileSync(gc, JSON.stringify({ enabled: false }, null, 2) + '\n')

  // 2. symlink the emitter into <home>/.claude/hooks
  const hooksDir = path.join(home, '.claude', 'hooks')
  fs.mkdirSync(hooksDir, { recursive: true })
  const link = path.join(hooksDir, 'sage-emit.mjs')
  const target = path.join(repoRoot, 'hooks', 'sage-emit.mjs')
  _symlinkConservative(link, target)

  // 3. merge lifecycle hooks into settings.json — throws on malformed JSON
  const settingsPath = path.join(home, '.claude', 'settings.json')
  _mergeSettings(settingsPath, link, nodeExecPath)

  // 4. tmux fleet pane
  const tmuxConf = path.join(home, '.tmux.conf')
  const sageBin = path.join(repoRoot, 'bin', 'sage')
  const tmuxNote = _wireTmux(tmuxConf, sageBin, nodeExecPath)

  // 5. symlink skills (opt-out: skipSkill or SAGE_SKIP_SKILL=1)
  const skillNote = skipSkill ? 'skipped (SAGE_SKIP_SKILL=1)' : _wireSkills(home, repoRoot)

  return { gc, link, target, settingsPath, tmuxConf, tmuxNote, skillNote, sageBin }
}

/**
 * Format the wireAll result into the human-readable install summary.
 */
export function formatResult({ gc, link, target, settingsPath, tmuxConf, tmuxNote, skillNote, sageBin }) {
  return (
    `SAGE installed — DISABLED by default.\n` +
    `  config:   ${gc}\n` +
    `  hook:     ${link} -> ${target}\n` +
    `  settings: ${settingsPath} (backed up to .bak if it existed)\n` +
    `  tmux:     ${tmuxConf} — ${tmuxNote}\n` +
    `  skills:   ~/.claude/skills — ${skillNote}\n` +
    `  pointer:  paste templates/CLAUDE.snippet.md into your repo/user CLAUDE.md to wire sessions in\n` +
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
      fs.renameSync(link, link + '.bak')
      fs.symlinkSync(target, link)
    }
  } else {
    fs.symlinkSync(target, link)
  }
}

function _mergeSettings(settingsPath, hookLink, nodeExecPath) {
  let settings = {}
  if (fs.existsSync(settingsPath)) {
    const bak = settingsPath + '.bak'
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
  const command = `${JSON.stringify(nodeExecPath)} ${JSON.stringify(hookLink)}`
  for (const ev of HOOK_EVENTS) {
    settings.hooks[ev] = settings.hooks[ev] || []
    const present = settings.hooks[ev].some((group) =>
      (group.hooks || []).some((h) => h.command === command),
    )
    if (!present) settings.hooks[ev].push({ hooks: [{ type: 'command', command }] })
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
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
  if (conf && !fs.existsSync(tmuxConf + '.bak')) fs.copyFileSync(tmuxConf, tmuxConf + '.bak')
  fs.appendFileSync(
    tmuxConf,
    `${conf && !conf.endsWith('\n') ? '\n' : ''}# SAGE fleet pane (bind j)\n${bindLine}\n`,
  )
  return `added \`bind j\` → run \`tmux source-file ~/.tmux.conf\` to apply`
}

function _wireSkills(home, repoRoot) {
  const skillsDir = path.join(home, '.claude', 'skills')
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
      } else if (fs.existsSync(slink + '.bak')) {
        notes.push(`${name}: left as-is (${name}.bak taken)`)
      } else {
        fs.renameSync(slink, slink + '.bak')
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
