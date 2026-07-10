#!/usr/bin/env node
// Hint-only postinstall — no filesystem writes; safe under --ignore-scripts / CI.
const bold = (s) => `\x1b[1m${s}\x1b[0m`
process.stdout.write(
  `\n  agentic-sage installed.\n  Run ${bold('sage init')} to wire skills and hooks (into ~/.claude; Grok reads via compat + supports native .grok)\n\n`,
)
