#!/usr/bin/env node
// Reverse install.mjs — SURGICALLY. Removes ONLY SAGE's own artifacts, matched
// by signature (symlink target inside this repo · hook command contains
// `sage-emit` · the exact tmux line we appended). Never touches a foreign hook,
// a foreign tmux line, or your ~/.claude/agentic-sage state (printed for manual
// delete). Handles BOTH the current (agentic-sage-emit.mjs) and legacy
// (sage-emit.mjs) hook names so an un-repaired old install still uninstalls
// cleanly.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sageHome, legacySageHome } from '../lib/paths.mjs'
import { stabilizePackageRoot } from '../lib/user-scope-wiring.mjs'

const home = os.homedir()
const rawRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url))) // uninstall/ → package root
// wireAll stabilizes worktree checkouts to the main root — ownership must
// match both the path this uninstall lives on and the stabilized install root.
const stableRoot = stabilizePackageRoot(rawRoot)
const ownedRoots = [...new Set([rawRoot, stableRoot])]
// Both candidate hook files — whichever a past install() symlinked.
const hookFiles = [
  path.join(home, '.claude', 'hooks', 'agentic-sage-emit.mjs'),
  path.join(home, '.claude', 'hooks', 'sage-emit.mjs'),
]
// tmux bind signature install wrote: `${sageBin} board` after stabilize.
const sageBins = ownedRoots.map((r) => path.join(r, 'bin', 'sage'))
const report = []
// "Ours" = a symlink whose target is strictly inside an owned package root.
// `+ path.sep` so a sibling checkout that merely shares the name prefix is NOT ours.
const insideRepo = (p) => {
  try {
    if (!fs.lstatSync(p).isSymbolicLink()) return false
    const t = fs.readlinkSync(p)
    return ownedRoots.some((r) => t === r || t.startsWith(r + path.sep))
  } catch {
    return false
  }
}

// 1. settings.json — drop only hook groups whose command references one of
// the two exact hook files above (current or legacy name).
const settingsPath = path.join(home, '.claude', 'settings.json')
if (fs.existsSync(settingsPath)) {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    let removed = 0
    if (settings.hooks && typeof settings.hooks === 'object') {
      for (const ev of Object.keys(settings.hooks)) {
        const groups = Array.isArray(settings.hooks[ev]) ? settings.hooks[ev] : []
        // Match one of the EXACT hook files install could have symlinked —
        // not a loose `sage-emit` token — and filter at the INNER hook
        // level, so a group bundling a SAGE hook next to a foreign one keeps
        // the foreign one. A foreign command that merely mentions sage-emit
        // is never touched.
        for (const group of groups) {
          if (!Array.isArray(group.hooks)) continue
          const before = group.hooks.length
          group.hooks = group.hooks.filter(
            (h) =>
              !(typeof h.command === 'string' && hookFiles.some((hf) => h.command.includes(hf))),
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

// 2. emitter hook symlink(s) — only if they point into this repo. A past
// install may have left either name (or, mid-upgrade, neither/one).
for (const hookFile of hookFiles) {
  if (insideRepo(hookFile)) {
    fs.unlinkSync(hookFile)
    report.push(`unlinked ${hookFile}`)
  } else if (fs.existsSync(hookFile)) {
    report.push(`${hookFile} is not our symlink — left untouched`)
  }
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
  // Accept either raw or stabilized package root (worktree-run install → main).
  const needles = sageBins.map((b) => `${b} board`)
  const kept = lines.filter(
    (l) => !needles.some((n) => l.includes(n)) && l.trim() !== '# SAGE fleet pane (bind j)',
  )
  if (kept.length !== lines.length) {
    fs.copyFileSync(tmuxConf, tmuxConf + '.sage-uninstall.bak')
    fs.writeFileSync(tmuxConf, kept.join('\n'))
    report.push('~/.tmux.conf: removed the SAGE `bind j` line (backed up → .sage-uninstall.bak)')
  }
} catch {
  /* no tmux.conf */
}

// 5. STATE — never auto-deleted (your config + session history). Prints BOTH
// the current and legacy (pre-rename) state dirs when present — an
// un-repaired old install may still have data under the legacy path.
const state = sageHome(home)
const legacyState = legacySageHome(home)
const stateNotes = []
if (fs.existsSync(state)) {
  stateNotes.push(`kept ${state} (your config + session history) — delete manually if you want it gone:\n      rm -rf ${state}`)
}
if (fs.existsSync(legacyState)) {
  stateNotes.push(`kept ${legacyState} (legacy — pre-rename state) — delete manually if you want it gone:\n      rm -rf ${legacyState}`)
}
if (!stateNotes.length) stateNotes.push('no ~/.claude/agentic-sage state present')

console.log(
  `SAGE uninstalled (wiring only).\n${report.map((r) => '  - ' + r).join('\n')}\n` +
    stateNotes.map((n) => `  - ${n}`).join('\n'),
)
