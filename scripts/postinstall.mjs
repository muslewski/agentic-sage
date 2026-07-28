#!/usr/bin/env node
// Hint-only postinstall — no filesystem writes; safe under --ignore-scripts / CI.
const bold = (s) => `\x1b[1m${s}\x1b[0m`
process.stdout.write(`
  ${bold('agentic-sage')} installed (present — fleet sessions).

  Quick start:
    1. ${bold('sage init')}          wire hooks + skills (still OFF)
    2. ${bold('sage on')}            enable judging
    3. ${bold('sage gate')}          soft health (freshness + preferred judge)
    4. ${bold('sage judge run')}     optional live mind (or --harness none)

  Update later:
    ${bold('npm i -g agentic-sage@latest && sage init --repair')}

  Pair with ${bold('memory-atlas')} (past — architecture memory):
    npm i -D memory-atlas && npx atlas init   # per repo

`)
