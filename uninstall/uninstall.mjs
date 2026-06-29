#!/usr/bin/env node
// Reverse install.mjs — SURGICALLY. Removes ONLY SAGE's own artifacts, matched
// by signature (symlink target inside this repo · hook command contains
// `sage-emit` · the exact tmux line we appended). Never touches a foreign hook,
// a foreign tmux line, or your ~/.claude/sage state (printed for manual delete).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sageHome } from '../lib/paths.mjs'

const home = os.homedir()
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url))) // uninstall/ → repo root
const report = []
const insideRepo = (p) => {
  try {
    return fs.lstatSync(p).isSymbolicLink() && fs.readlinkSync(p).startsWith(repoRoot)
  } catch {
    return false
  }
}

// 1. settings.json — drop only hook groups whose command references sage-emit.
const settingsPath = path.join(home, '.claude', 'settings.json')
if (fs.existsSync(settingsPath)) {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    let removed = 0
    if (settings.hooks) {
      for (const ev of Object.keys(settings.hooks)) {
        const before = (settings.hooks[ev] || []).length
        settings.hooks[ev] = (settings.hooks[ev] || []).filter(
          (group) =>
            !(group.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes('sage-emit')),
        )
        removed += before - settings.hooks[ev].length
        if (!settings.hooks[ev].length) delete settings.hooks[ev] // drop a now-empty event
      }
    }
    if (removed) {
      fs.copyFileSync(settingsPath, settingsPath + '.sage-uninstall.bak')
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
      report.push(
        `settings.json: removed ${removed} sage-emit hook group(s) ` +
          `(backed up → .sage-uninstall.bak; foreign hooks untouched)`,
      )
    } else {
      report.push('settings.json: no sage-emit hooks found (nothing to remove)')
    }
  } catch {
    report.push('settings.json: not valid JSON — left untouched (remove the sage-emit hook manually)')
  }
}

// 2. emitter hook symlink — only if it points into this repo.
const hook = path.join(home, '.claude', 'hooks', 'sage-emit.mjs')
if (insideRepo(hook)) {
  fs.unlinkSync(hook)
  report.push(`unlinked ${hook}`)
} else if (fs.existsSync(hook)) {
  report.push(`${hook} is not our symlink — left untouched`)
}

// 3. skill symlinks — only ours (sage-*) pointing into this repo.
const skillsDir = path.join(home, '.claude', 'skills')
try {
  for (const name of fs.readdirSync(skillsDir)) {
    if (!name.startsWith('sage-')) continue
    const link = path.join(skillsDir, name)
    if (insideRepo(link)) {
      fs.unlinkSync(link)
      report.push(`unlinked ${link}`)
    }
  }
} catch {
  /* no skills dir */
}

// 4. tmux bind j — remove only the lines we appended (the comment + the bind).
const tmuxConf = path.join(home, '.tmux.conf')
try {
  const conf = fs.readFileSync(tmuxConf, 'utf8')
  const lines = conf.split('\n')
  const kept = lines.filter(
    (l) => !(l.includes('bin/sage') && l.includes('board')) && l.trim() !== '# SAGE fleet pane (bind j)',
  )
  if (kept.length !== lines.length) {
    fs.copyFileSync(tmuxConf, tmuxConf + '.sage-uninstall.bak')
    fs.writeFileSync(tmuxConf, kept.join('\n'))
    report.push('~/.tmux.conf: removed the SAGE `bind j` line (backed up → .sage-uninstall.bak)')
  }
} catch {
  /* no tmux.conf */
}

// 5. STATE — never auto-deleted (your config + session history).
const state = sageHome(home)
const keptNote = fs.existsSync(state)
  ? `kept ${state} (your config + session history) — delete manually if you want it gone:\n      rm -rf ${state}`
  : 'no ~/.claude/sage state present'

console.log(`SAGE uninstalled (wiring only).\n${report.map((r) => '  - ' + r).join('\n')}\n  - ${keptNote}`)
