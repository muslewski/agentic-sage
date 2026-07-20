// Hot-float with hysteresis for the war-room LIVE face. On top of the STABLE
// base order (lib/fleet.mjs sortFleet: first-seen, then repoId), repos that have
// a live *working* session float to a "hot" group at the top — but with a linger
// so a repo whose session flickers working→idle→working doesn't bounce between
// groups every tick. A repo JOINS the hot group the instant it has a working
// (or compacting) session, and only LEAVES after it has been continuously
// non-hot for `lingerMs`.
//
// Pure: the hysteresis memory (a Map repoId→lastHotMs) is passed in and a fresh
// one returned, so the caller (bin/sage runWarWatch) owns the state and tests
// are deterministic (inject `now`). Order within each group is preserved from
// the input, so a stable-ordered input yields a stable-ordered output.

const isHotRepo = (r) =>
  (r?.sessions || []).some((s) => s?.liveness === 'working' || s?.phase === 'compacting')

export const floatHot = (repos = [], hotState = new Map(), now = 0, { lingerMs = 4000 } = {}) => {
  const nextState = new Map()
  const hot = []
  const rest = []
  for (const r of repos) {
    const hotNow = isHotRepo(r)
    // lastHotMs: when this repo was most recently hot. Refresh to `now` while
    // hot; otherwise carry the previous stamp forward so linger can elapse.
    const lastHotMs = hotNow ? now : hotState.get(r.repoId)
    if (lastHotMs !== undefined) nextState.set(r.repoId, lastHotMs)
    const inHotGroup = hotNow || (lastHotMs !== undefined && now - lastHotMs < lingerMs)
    ;(inHotGroup ? hot : rest).push(r)
  }
  return { hot, rest, order: hot.concat(rest), hotCount: hot.length, hotState: nextState }
}
