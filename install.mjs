#!/usr/bin/env node
// Wire SAGE into ~/.claude.  All logic lives in lib/wiring.mjs (injectable for tests).
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { wireAll, formatResult } from './lib/wiring.mjs'

const home = os.homedir()
const repoRoot = path.dirname(fileURLToPath(import.meta.url))
try {
  const result = wireAll({ home, repoRoot })
  console.log(formatResult(result))
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
