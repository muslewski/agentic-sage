// A flat per-session "asking" breadcrumb: ~/.claude/agentic-sage/asking/<session_id>
// (or equivalent under storage). Its mtime is the last-consult time; the body is
// the consulting verb (so `cat` is debuggable). Keyed by session_id (Claude/Grok/etc)
// with NO repoId, so a statusline reads it with a bare stat (the verb and an
// in-process reader use the same path). Works for any agent that calls the verbs.
import fs from 'node:fs'
import path from 'node:path'
import { sageHome } from './paths.mjs'

export const askingDir = (home) => path.join(sageHome(home), 'asking')

// Sanitize to a flat filename — '/' '\' and '.' all map to '_', so no name can
// be '.', '..', or contain a separator (session_ids are UUIDs; unaffected).
export const safeSid = (sid) => String(sid).replace(/[^A-Za-z0-9_-]/g, '_') || '_'

export const askingFile = (home, sid) => path.join(askingDir(home), safeSid(sid))

export const markAsking = (home, sid, verb = '') => {
  if (!sid) return
  fs.mkdirSync(askingDir(home), { recursive: true })
  fs.writeFileSync(askingFile(home, sid), `${verb}\n`)
}

export const askingAgeMs = (home, sid, now) => {
  try {
    return now - fs.statSync(askingFile(home, sid)).mtimeMs
  } catch {
    return Infinity
  }
}

export const clearAsking = (home, sid) => {
  try {
    fs.unlinkSync(askingFile(home, sid))
  } catch {
    /* absent — fine */
  }
}
