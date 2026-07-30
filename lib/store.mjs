// Per-session record store + append-only event log. Multiple writer
// processes (the emitter hook AND the CLI) touch the same session file.
// Writes are atomic (tmp + rename) so a concurrent reader never sees a
// half-written record; a per-file lock around mergeRecord's read-modify-write
// serializes concurrent merges so neither writer's fields are lost.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { sessionFile, eventsFile, sessionsDir, repoDir } from './paths.mjs'

const ensureDir = (file) => fs.mkdirSync(path.dirname(file), { recursive: true })

// Session ids become filenames under sessions/. Reject path separators, `..`,
// and anything that would resolve outside the intended sessions directory.
export const isSafeSessionId = (sid) => {
  if (typeof sid !== 'string' || !sid) return false
  if (sid.length > 200) return false
  if (/[/\\]/.test(sid)) return false
  if (sid.includes('..')) return false
  if (sid === '.' || sid === '..') return false
  // printable token only — no control chars, no absolute-ish prefixes
  if (!/^[A-Za-z0-9._@+=:-]+$/.test(sid)) return false
  return true
}

/**
 * Ensure `file` resolves inside `root` (after realpath). Refuses symlink escape
 * and path traversal. Throws on containment failure.
 * @param {string} file absolute or relative target path
 * @param {string} root intended root directory (created if missing)
 */
export const assertPathInside = (file, root) => {
  fs.mkdirSync(root, { recursive: true })
  let realRoot
  try {
    realRoot = fs.realpathSync(root)
  } catch {
    realRoot = path.resolve(root)
  }
  const resolved = path.resolve(file)
  // Walk every ancestor of `file` with lstat: a symlink that realpaths outside
  // `root` is an escape (sessions/ → /tmp is the classic case). Never trust the
  // lexical path alone — it still "starts with" root before the link is followed.
  let cur = resolved
  for (;;) {
    try {
      const lst = fs.lstatSync(cur)
      if (lst.isSymbolicLink()) {
        const real = fs.realpathSync(cur)
        if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
          throw new Error(`path escapes storage root: ${file}`)
        }
      }
    } catch (e) {
      if (e && /escapes storage root/.test(e.message)) throw e
      // ENOENT — keep walking; parent may still be a bad symlink
    }
    const parent = path.dirname(cur)
    if (parent === cur) break
    cur = parent
    // Stop once we leave the lexical root tree (no need to scan /)
    if (cur !== path.resolve(root) && !cur.startsWith(path.resolve(root) + path.sep)) break
  }
  // Final destination (following all links) must sit inside realRoot.
  try {
    const realFile = fs.existsSync(resolved) ? fs.realpathSync(resolved) : null
    if (realFile && realFile !== realRoot && !realFile.startsWith(realRoot + path.sep)) {
      throw new Error(`path escapes storage root: ${file}`)
    }
  } catch (e) {
    if (e && /escapes storage root/.test(e.message)) throw e
  }
  // Parent dir after realpath (create path) must also be inside.
  const parent = path.dirname(resolved)
  try {
    if (fs.existsSync(parent)) {
      const realParent = fs.realpathSync(parent)
      if (realParent !== realRoot && !realParent.startsWith(realRoot + path.sep)) {
        throw new Error(`path escapes storage root: ${file}`)
      }
    }
  } catch (e) {
    if (e && /escapes storage root/.test(e.message)) throw e
  }
  return resolved
}

// Serialize the read-modify-write in mergeRecord: the emitter hook and the
// CLI (claim / link) are INDEPENDENT PROCESSES writing the same session file,
// and an unserialized merge loses whichever write renames first (a lost
// `claimed_globs` is a silently broken coordination promise). mkdir is the
// zero-dep atomic test-and-set; bounded retries + stale takeover + proceed-
// unlocked keep the fail-open contract — a hook may briefly wait, never hang.
const LOCK_RETRIES = 50
const LOCK_WAIT_MS = 5
const LOCK_STALE_MS = 2000

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const withFileLock = (file, fn) => {
  ensureDir(file)
  const lock = `${file}.lock`
  let held = false
  for (let i = 0; i < LOCK_RETRIES && !held; i++) {
    try {
      fs.mkdirSync(lock)
      held = true
    } catch {
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) {
          fs.rmdirSync(lock)
          continue // takeover attempt — loop re-tries mkdir immediately
        }
      } catch {
        /* lock vanished between EEXIST and stat — retry */
      }
      sleep(LOCK_WAIT_MS)
    }
  }
  try {
    return fn()
  } finally {
    if (held)
      try {
        fs.rmdirSync(lock)
      } catch {
        /* already reaped — fine */
      }
  }
}

// Generic atomic JSON persistence (tmp + rename) reused by the session-record
// store AND the handoff sidecar (lib/handoff.mjs). A concurrent reader never
// sees a half-written file.
// Optional `root`: when set, refuse writes that would escape that directory
// (covers sessions/ symlink escape).
export const atomicWriteJson = (file, obj, { root } = {}) => {
  if (root) assertPathInside(file, root)
  ensureDir(file)
  // If the destination path itself is a symlink pointing outside root, refuse.
  try {
    const lst = fs.lstatSync(file)
    if (lst.isSymbolicLink() && root) {
      assertPathInside(fs.realpathSync(file), root)
    }
  } catch {
    /* ENOENT — fine */
  }
  const tmp = `${file}.tmp.${crypto.randomBytes(6).toString('hex')}`
  if (root) assertPathInside(tmp, root)
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2))
  fs.renameSync(tmp, file)
  return obj
}

// Regular files only — FIFO/socket/dir would block readFileSync forever.
export const readJson = (file) => {
  try {
    const st = fs.statSync(file)
    if (!st.isFile()) return null
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export const readRecord = (home, id, sid) => {
  if (!isSafeSessionId(sid)) return null
  return readJson(sessionFile(home, id, sid))
}

export const writeRecord = (home, id, sid, rec) => {
  if (!isSafeSessionId(sid)) throw new Error(`unsafe session id: ${sid}`)
  const file = sessionFile(home, id, sid)
  const root = repoDir(home, id)
  return atomicWriteJson(file, rec, { root })
}

export const mergeRecord = (home, id, sid, patch) => {
  if (!isSafeSessionId(sid)) throw new Error(`unsafe session id: ${sid}`)
  const file = sessionFile(home, id, sid)
  const root = repoDir(home, id)
  return withFileLock(file, () => {
    const cur = readRecord(home, id, sid) || {}
    // Object-spread only when cur is a plain object (corrupt non-object → replace)
    const base = cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : {}
    return atomicWriteJson(file, { ...base, ...patch }, { root })
  })
}

export const appendEvent = (home, id, evt) => {
  const file = eventsFile(home, id)
  const root = repoDir(home, id)
  assertPathInside(file, root)
  ensureDir(file)
  fs.appendFileSync(file, `${JSON.stringify(evt)}\n`)
}
