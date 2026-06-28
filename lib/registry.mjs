// Best-effort: find the OS pid for a session_id by reversing the existing
// Claude Code session registry (~/.claude/sessions/<pid>.json). Absent ⇒ null;
// SAGE degrades gracefully without a pid.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const pidForSession = (home = os.homedir(), sessionId) => {
  if (!sessionId) return null
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
    /* no registry dir */
  }
  return null
}
