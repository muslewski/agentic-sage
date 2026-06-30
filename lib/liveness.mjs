// PID liveness + a coarse session-state enum. Full staleness (handoff age,
// truth-drift) lands in a later phase; P1 needs only alive/dead + the basic
// idle/working/stalled/closed mapping.

// signal 0 probes without killing: success ⇒ alive; EPERM ⇒ exists but not
// ours (still alive); ESRCH ⇒ gone.
export const isAlive = (pid) => {
  if (!pid || pid < 1) return false // 0 = group probe, negatives = group/all — never a session
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

// Derive the state enum from the SIGNALS the emitter actually records on a
// session: `alive` (pid probe), `closed` (SessionEnd seen), and `lastToolAt`
// recency. A consumer (P3 board) passes a stored record's fields straight in.
export const deriveLiveness = ({
  alive,
  closed,
  lastToolAt,
  now = Date.now(),
  stallMs = 600000,
} = {}) => {
  if (closed) return 'closed'
  if (alive === false) return 'dead'
  if (lastToolAt) {
    const t = typeof lastToolAt === 'string' ? Date.parse(lastToolAt) : lastToolAt
    return now - t > stallMs ? 'stalled' : 'working'
  }
  return 'idle'
}
