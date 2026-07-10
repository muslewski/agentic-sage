// Best-effort: find the OS pid for a session_id by reversing the harness
// session registries. Supports Claude (~/.claude/sessions/<pid>.json) and
// Grok (~/.grok/active_sessions.json). Absent ⇒ null; degrades gracefully.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const pidForSession = (home = os.homedir(), sessionId) => {
  if (!sessionId) return null
  // 1. Claude registry (per-pid json files)
  try {
    const dir = path.join(home, '.claude', 'sessions')
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
        if (j.sessionId === sessionId && j.pid) return j.pid
      } catch {
        /* skip unreadable entry */
      }
    }
  } catch {
    /* no claude registry dir */
  }
  // 2. Grok active sessions (array of {session_id, pid, cwd, ...})
  try {
    const act = path.join(home, '.grok', 'active_sessions.json')
    const arr = JSON.parse(fs.readFileSync(act, 'utf8'))
    if (Array.isArray(arr)) {
      for (const e of arr) {
        if ((e.session_id === sessionId || e.sessionId === sessionId) && e.pid) {
          return e.pid
        }
      }
    }
  } catch {
    /* absent or unreadable */
  }
  return null
}
