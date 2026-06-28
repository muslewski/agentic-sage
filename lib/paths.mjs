// All filesystem paths for SAGE state, derived from an injectable `home`
// (defaults to the real home dir; overridden to a temp dir in tests).
import os from 'node:os'
import path from 'node:path'

export const sageHome = (home = os.homedir()) => path.join(home, '.claude', 'sage')
export const globalConfig = (home = os.homedir()) => path.join(sageHome(home), 'config.json')
export const repoDir = (home, id) => path.join(sageHome(home), 'repos', id)
export const repoConfig = (home, id) => path.join(repoDir(home, id), 'config.json')
export const sessionsDir = (home, id) => path.join(repoDir(home, id), 'sessions')
export const sessionFile = (home, id, sid) => path.join(sessionsDir(home, id), `${sid}.json`)
export const eventsFile = (home, id) => path.join(repoDir(home, id), 'events.ndjson')
export const guardConfig = (home, id) => path.join(repoDir(home, id), 'guard.json')
export const guardsActiveFlag = (home = os.homedir()) => path.join(sageHome(home), 'guards-active')
