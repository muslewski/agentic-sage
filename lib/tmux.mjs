// Node-native tmux awareness — the project-agnostic reuse of
// claude_sessions.py::tmux_panes() (same -F format, so the two systems agree on
// pane identity). Read-only, bounded, degrades to []/null on no tmux server / no
// /proc (macOS) / a dead pid — never throws (the board calls it best-effort).
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
