// PostToolUse throttle breadcrumb: ~/.claude/sage/last-tool/<safeSid>. Its
// mtime is the last time a PostToolUse actually wrote the session record.
// Lets the emitter skip the ~29/30 throttled firings BEFORE resolving the
// repo id (i.e. before any git spawn) — the record's last_tool_at stays the
// truth the board reads; this file only gates the hot path.
import fs from 'node:fs'
import path from 'node:path'
import { sageHome } from './paths.mjs'
import { safeSid } from './asking.mjs'

export const lastToolFile = (home, sid) => path.join(sageHome(home), 'last-tool', safeSid(sid))

// Due = no breadcrumb yet, or the window has elapsed. Any stat error ⇒ due
// (fail-open toward writing — worst case one extra record write).
export const postToolDue = (home, sid, now, windowMs) => {
  try {
    return now - fs.statSync(lastToolFile(home, sid)).mtimeMs >= windowMs
  } catch {
    return true
  }
}

export const markPostTool = (home, sid) => {
  const f = lastToolFile(home, sid)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, '')
}
