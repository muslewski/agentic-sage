// Node-native tmux awareness — pid/pane matching. Works for any agent (Claude,
// Grok, etc) whose process tree runs inside a tmux pane. Read-only, bounded,
// degrades gracefully — never throws (the board calls it best-effort). Reuses
// the same pane format logic as other claude-era tools for compatibility.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const FMT = '#{pane_pid}\t#{session_name}:#{window_index}\t#{window_id}'

export const parsePanes = (raw) =>
  raw
    .split('\n')
    .map((l) => l.split('\t'))
    .filter((p) => p.length >= 3 && /^\d+$/.test(p[0]))
    .map(([panePid, pane, windowId]) => ({ panePid: Number(panePid), pane, windowId }))

export const tmuxPanes = (tmux = 'tmux') => {
  try {
    const raw = execFileSync(tmux, ['list-panes', '-a', '-F', FMT], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    })
    return parsePanes(raw)
  } catch {
    return []
  }
}

// PPID of a pid via /proc/<pid>/stat. The comm field (field 2) is wrapped in
// parens and may itself contain spaces/parens, so slice past the LAST ')':
// the remainder is "state ppid …".
export const ppidOf = (pid) => {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
    const after = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
    return Number(after[1]) || 0 // after[0]=state, after[1]=ppid
  } catch {
    return 0
  }
}

// comm (process name) via /proc/<pid>/stat — the parenthesised field 2. Slice
// between the first '(' and the LAST ')' (comm may itself contain parens).
export const commOf = (pid) => {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
    const open = stat.indexOf('(')
    const close = stat.lastIndexOf(')')
    return open >= 0 && close > open ? stat.slice(open + 1, close) : ''
  } catch {
    return ''
  }
}

// Full command line via /proc/<pid>/cmdline (NUL-separated → space-joined).
export const cmdlineOf = (pid) => {
  try {
    return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim()
  } catch {
    return ''
  }
}

// tmux window name for a `session:window` target — best-effort, '' on failure.
export const windowNameForPane = (pane, tmux = 'tmux') => {
  if (!pane) return ''
  try {
    return execFileSync(tmux, ['display-message', '-p', '-t', pane, '-F', '#{window_name}'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim()
  } catch {
    return ''
  }
}

// Walk the parent chain of `pid` until a pid matches a pane's owning process.
export const paneForPid = (pid, panes) => {
  const byPid = new Map(panes.map((p) => [p.panePid, p.pane]))
  let cur = Number(pid)
  for (let hop = 0; hop < 30 && cur > 1; hop++) {
    if (byPid.has(cur)) return byPid.get(cur)
    cur = ppidOf(cur)
  }
  return null
}
