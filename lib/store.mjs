// Per-session record store + append-only event log. Multiple writer
// processes (the emitter hook AND the CLI) touch the same session file.
// Writes are atomic (tmp + rename) so a concurrent reader never sees a
// half-written record; a per-file lock around mergeRecord's read-modify-write
// serializes concurrent merges so neither writer's fields are lost.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { sessionFile, eventsFile } from './paths.mjs'

const ensureDir = (file) => fs.mkdirSync(path.dirname(file), { recursive: true })

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
export const atomicWriteJson = (file, obj) => {
  ensureDir(file)
  const tmp = `${file}.tmp.${crypto.randomBytes(6).toString('hex')}`
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2))
  fs.renameSync(tmp, file)
  return obj
}

export const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export const readRecord = (home, id, sid) => readJson(sessionFile(home, id, sid))

export const writeRecord = (home, id, sid, rec) => atomicWriteJson(sessionFile(home, id, sid), rec)

export const mergeRecord = (home, id, sid, patch) =>
  withFileLock(sessionFile(home, id, sid), () => {
    const cur = readRecord(home, id, sid) || {}
    return writeRecord(home, id, sid, { ...cur, ...patch })
  })

export const appendEvent = (home, id, evt) => {
  const file = eventsFile(home, id)
  ensureDir(file)
  fs.appendFileSync(file, `${JSON.stringify(evt)}\n`)
}
