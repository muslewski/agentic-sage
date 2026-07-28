#!/usr/bin/env node
// Hint-only postinstall — no filesystem writes; safe under --ignore-scripts / CI.
const bold = (s) => `\x1b[1m${s}\x1b[0m`
process.stdout.write(`
  ${bold('agentic-sage')} installed.

  5-minute install:
    ${bold('npm i -g agentic-sage@latest')}
    ${bold('sage init --global --harness both --enable')}   # or: sage init … then sage on
    ${bold('sage judge desired preferred')}                 # optional desk preference (or optional)
    ${bold('sage gate')}  ·  ${bold('sage doctor')}  ·  ${bold('sage judge run')}

  Update path:
    ${bold('npm i -g agentic-sage@latest && sage init --repair')}
    then ${bold('sage gate')}

`)
