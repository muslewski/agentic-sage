// Bounded stdin read for hook/statusline entrypoints. A hook's stdin is a
// pipe Claude Code writes then closes; if a writer ever holds it open, an
// unbounded read would hang the process and break the never-block contract.
// Resolves with whatever arrived when 'end' fires or the deadline lapses —
// never rejects.
export const readStdinWithDeadline = (deadlineMs, stdin = process.stdin) =>
  new Promise((resolve) => {
    let buf = ''
    const done = () => {
      clearTimeout(timer)
      resolve(buf)
    }
    const timer = setTimeout(done, deadlineMs)
    stdin.setEncoding('utf8')
    stdin.on('data', (c) => {
      buf += c
    })
    stdin.on('end', done)
    stdin.on('error', done)
  })
