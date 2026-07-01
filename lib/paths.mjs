// All filesystem paths for SAGE state, derived from an injectable `home`
// (defaults to the real home dir; overridden to a temp dir in tests).
//
// repoDir is rerouted through lib/roots.mjs's storage-root resolver
// (resolveRepoDataDir) instead of hardcoding <sageHome>/repos/<id> directly —
// every signature here and every path it produces is UNCHANGED (the
// built-in default rule in roots.mjs still yields the same literal). Global-
// level paths (globalConfig, guardsActiveFlag) stay joined off sageHome(home)
// directly: they are agent-home state, not repo data, and never move with a
// repo's storage root.
import os from 'node:os'
import path from 'node:path'
import { resolveRepoDataDir } from './roots.mjs'

export { sageHome } from './roots.mjs'
import { sageHome } from './roots.mjs'

export const globalConfig = (home = os.homedir()) => path.join(sageHome(home), 'config.json')
export const repoDir = (home, id) => resolveRepoDataDir({ home, repoId: id })
export const repoConfig = (home, id) => path.join(repoDir(home, id), 'config.json')
export const sessionsDir = (home, id) => path.join(repoDir(home, id), 'sessions')
export const sessionFile = (home, id, sid) => path.join(sessionsDir(home, id), `${sid}.json`)
export const eventsFile = (home, id) => path.join(repoDir(home, id), 'events.ndjson')
export const guardConfig = (home, id) => path.join(repoDir(home, id), 'guard.json')
export const guardsActiveFlag = (home = os.homedir()) => path.join(sageHome(home), 'guards-active')
