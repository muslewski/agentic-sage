#!/usr/bin/env node
// Wire SAGE into ~/.claude (primary; works for Grok via [compat.claude] defaults for hooks/skills).
// All logic lives in lib/wiring.mjs (injectable for tests). For native Grok hooks see templates/GROK.snippet.md and hooks docs.
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
