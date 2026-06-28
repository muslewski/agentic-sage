// PID liveness + a coarse session-state enum. Full staleness (handoff age,
// truth-drift) lands in a later phase; P1 needs only alive/dead + the basic
// idle/working/stalled/closed mapping.

// signal 0 probes without killing: success ⇒ alive; EPERM ⇒ exists but not
// ours (still alive); ESRCH ⇒ gone.
export const isAlive = (pid) => {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

export const deriveLiveness = ({
  alive,
  closed,
  status,
  lastToolAt,
  now = Date.now(),
  stallMs = 600000,
} = {}) => {
  if (closed) return 'closed'
  if (alive === false) return 'dead'
  if (status === 'working') {
    if (lastToolAt && now - lastToolAt > stallMs) return 'stalled'
    return 'working'
  }
  return 'idle'
}
