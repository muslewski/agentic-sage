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
const hookFile = path.join(home, '.claude', 'hooks', 'sage-emit.mjs') // the EXACT file install symlinked
const sageBin = path.join(repoRoot, 'bin', 'sage') // tmux bind signature install wrote: `${sageBin} board`
const report = []
// "Ours" = a symlink whose target is strictly inside this repo. `+ path.sep` so a
// sibling checkout that merely shares the name prefix (agentic-sage-2/) is NOT ours.
const insideRepo = (p) => {
  try {
    return fs.lstatSync(p).isSymbolicLink() && fs.readlinkSync(p).startsWith(repoRoot + path.sep)
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
    if (settings.hooks && typeof settings.hooks === 'object') {
      for (const ev of Object.keys(settings.hooks)) {
        const groups = Array.isArray(settings.hooks[ev]) ? settings.hooks[ev] : []
        // Match the EXACT hook file install symlinked — not a loose `sage-emit`
        // token — and filter at the INNER hook level, so a group bundling a SAGE
        // hook next to a foreign one keeps the foreign one. A foreign command that
        // merely mentions sage-emit is never touched.
        for (const group of groups) {
          if (!Array.isArray(group.hooks)) continue
          const before = group.hooks.length
          group.hooks = group.hooks.filter(
            (h) => !(typeof h.command === 'string' && h.command.includes(hookFile)),
          )
          removed += before - group.hooks.length
        }
        // drop only a group WE emptied; keep any group still holding a foreign hook
        settings.hooks[ev] = groups.filter((g) => !Array.isArray(g.hooks) || g.hooks.length)
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
if (insideRepo(hookFile)) {
  fs.unlinkSync(hookFile)
  report.push(`unlinked ${hookFile}`)
} else if (fs.existsSync(hookFile)) {
  report.push(`${hookFile} is not our symlink — left untouched`)
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
  // Match the EXACT string install appended (`${sageBin} board`), not loose
  // substrings — a user line with `bin/sage` + `keyboard` must NOT be removed.
  const needle = `${sageBin} board`
  const kept = lines.filter((l) => !l.includes(needle) && l.trim() !== '# SAGE fleet pane (bind j)')
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
