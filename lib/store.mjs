// Per-session record store + append-only event log. One writer per session
// file. Writes are atomic (tmp + rename) so a concurrent reader never sees a
// half-written record.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { sessionFile, eventsFile } from './paths.mjs'

const ensureDir = (file) => fs.mkdirSync(path.dirname(file), { recursive: true })

export const readRecord = (home, id, sid) => {
  try {
    return JSON.parse(fs.readFileSync(sessionFile(home, id, sid), 'utf8'))
  } catch {
    return null
  }
}

export const writeRecord = (home, id, sid, rec) => {
  const file = sessionFile(home, id, sid)
  ensureDir(file)
  const tmp = `${file}.tmp.${crypto.randomBytes(6).toString('hex')}`
  fs.writeFileSync(tmp, JSON.stringify(rec, null, 2))
  fs.renameSync(tmp, file)
  return rec
}

export const mergeRecord = (home, id, sid, patch) => {
  const cur = readRecord(home, id, sid) || {}
  return writeRecord(home, id, sid, { ...cur, ...patch })
}

export const appendEvent = (home, id, evt) => {
  const file = eventsFile(home, id)
  ensureDir(file)
  fs.appendFileSync(file, JSON.stringify(evt) + '\n')
}
