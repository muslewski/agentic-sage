#!/usr/bin/env node
// Wire SAGE into ~/.claude. Idempotent and CONSERVATIVE:
//   - seeds a DISABLED global config (never overwrites an existing one)
//   - NEVER writes {enabled:true} — activation is the human's explicit choice
//   - symlinks the emitter hook (backs up a non-symlink collision)
//   - merges 6 lifecycle hooks into settings.json (backs it up first,
//     skips entries already present, preserves unrelated hooks)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sageHome, globalConfig } from './lib/paths.mjs'

// PreToolUse drives the default-OFF guard (P7). Inert until a guard is armed
// (sage guard on) — the emitter fast-skips on a cheap breadcrumb otherwise.
const HOOK_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop', 'PreCompact', 'SessionEnd', 'PreToolUse']

const home = os.homedir()
const repoRoot = path.dirname(fileURLToPath(import.meta.url))

// 1. seed default-OFF global config (never clobber)
fs.mkdirSync(sageHome(home), { recursive: true })
const gc = globalConfig(home)
if (!fs.existsSync(gc)) fs.writeFileSync(gc, JSON.stringify({ enabled: false }, null, 2) + '\n')

// 2. symlink the emitter into ~/.claude/hooks
const hooksDir = path.join(home, '.claude', 'hooks')
fs.mkdirSync(hooksDir, { recursive: true })
const link = path.join(hooksDir, 'sage-emit.mjs')
const target = path.join(repoRoot, 'hooks', 'sage-emit.mjs')
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
    fs.renameSync(link, link + '.bak') // back up a real file we didn't create
    fs.symlinkSync(target, link)
  }
} else {
  fs.symlinkSync(target, link)
}

// 3. merge lifecycle hooks into settings.json (back up once, skip-if-present).
// On malformed JSON we ABORT — never overwrite the human's live config.
const settingsPath = path.join(home, '.claude', 'settings.json')
let settings = {}
if (fs.existsSync(settingsPath)) {
  const bak = settingsPath + '.bak'
  if (!fs.existsSync(bak)) fs.copyFileSync(settingsPath, bak) // preserve the PRISTINE original
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  } catch {
    console.error(
      `SAGE install ABORTED: ${settingsPath} is not valid JSON. ` +
        `Fix it and re-run — no changes were made to it.`,
    )
    process.exit(1)
  }
}
settings.hooks = settings.hooks || {}
// Quote both paths and use the absolute node binary (process.execPath) so a
// space in $HOME or an nvm-managed node (not on the hook shell's PATH) can't
// leave SAGE installed-but-dead.
const command = `${JSON.stringify(process.execPath)} ${JSON.stringify(link)}`
for (const ev of HOOK_EVENTS) {
  settings.hooks[ev] = settings.hooks[ev] || []
  const present = settings.hooks[ev].some((group) =>
    (group.hooks || []).some((h) => h.command === command),
  )
  if (!present) settings.hooks[ev].push({ hooks: [{ type: 'command', command }] })
}
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')

// 4. tmux fleet pane — idempotent, additive (mirrors the existing `bind g`).
//    Absolute node + sage path so the popup works regardless of the shell PATH.
const tmuxConf = path.join(home, '.tmux.conf')
const sageBin = path.join(repoRoot, 'bin', 'sage')
const bindLine = `bind j display-popup -E -w 90% -h 70% '${process.execPath} ${sageBin} board'`
let conf = ''
try {
  conf = fs.readFileSync(tmuxConf, 'utf8')
} catch {
  /* no tmux.conf yet */
}
let tmuxNote = `already present (skipped)`
if (!conf.includes(`${sageBin} board`)) {
  if (conf && !fs.existsSync(tmuxConf + '.bak')) fs.copyFileSync(tmuxConf, tmuxConf + '.bak')
  fs.appendFileSync(tmuxConf, `${conf && !conf.endsWith('\n') ? '\n' : ''}# SAGE fleet pane (bind j)\n${bindLine}\n`)
  tmuxNote = `added \`bind j\` → run \`tmux source-file ~/.tmux.conf\` to apply`
}

// 5. symlink every skills/* dir into ~/.claude/skills (opt-out: SAGE_SKIP_SKILL=1).
//    Same conservative discipline as the hook: skip-if-linked, back up a real
//    collision, never clobber a taken .bak. Presence is inert — a skill is a no-op
//    until SAGE is on AND a session (or the user, for /sage-doctor) invokes it.
let skillNote = 'skipped (SAGE_SKIP_SKILL=1)'
if (!process.env.SAGE_SKIP_SKILL) {
  const skillsDir = path.join(home, '.claude', 'skills')
  fs.mkdirSync(skillsDir, { recursive: true })
  const srcSkills = path.join(repoRoot, 'skills')
  let names = []
  try {
    names = fs.readdirSync(srcSkills, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
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
        // a real dir/file is here AND a .bak already exists — never clobber either; leave it.
        notes.push(`${name}: left as-is (${name}.bak taken)`)
      } else {
        fs.renameSync(slink, slink + '.bak') // back up a real dir/file we didn't create
        fs.symlinkSync(starget, slink)
        notes.push(`${name}: backed up → .bak, linked`)
      }
    } else {
      fs.symlinkSync(starget, slink)
      notes.push(`${name}: linked`)
    }
  }
  skillNote = notes.length ? notes.join('; ') : 'no skills to link'
}

console.log(`SAGE installed — DISABLED by default.
  config:   ${gc}
  hook:     ${link} -> ${target}
  settings: ${settingsPath} (backed up to .bak if it existed)
  tmux:     ${tmuxConf} — ${tmuxNote}
  skills:   ~/.claude/skills — ${skillNote}
  pointer:  paste templates/CLAUDE.snippet.md into your repo/user CLAUDE.md to wire sessions in
  verify:   run \`/sage-doctor\` (or \`${sageBin} doctor\`) to validate the wiring
Enable when ready:  edit ${gc} → {"enabled": true}  (or: sage on)
Fleet line:  add \`${sageBin} fleet\` to your session-sync tick for an always-on summary.
Guard:    built but OFF — arm per repo with \`sage guard add <path>\` then \`sage guard on\`
          (blocks edits to contested paths via exit 2; fail-open + default-OFF).`)
