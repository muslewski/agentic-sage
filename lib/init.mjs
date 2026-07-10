// lib/init.mjs — `sage init` front-end: flag parsing, the interactive wizard,
// and the summary/show renderers. Zero-dep: the wizard is hand-rolled on the
// readline promises API below (no prompt library — see AGENTS/plan constraints).
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { getHarness } from './harness.mjs'
import { MARKER_DIR, registryPath, explainRepoDataDir, sageHome, legacySageHome } from './roots.mjs'
import { resolveRepo } from './repo-id.mjs'
import { globalConfig, repoConfig } from './paths.mjs'
import { readJson } from './store.mjs'

// ── parseInitArgs — pure, no fs ─────────────────────────────────────────────

// Decisive flags: any of these present ⇒ skip the interactive wizard.
const DECISIVE = new Set(['--global', '--project', '--repair', '--show', '--yes'])

/**
 * Parse `sage init` argv into a config object. Pure function — no fs, no TTY
 * checks (the caller decides whether to actually run the wizard).
 * @param {string[]} argv
 * @returns {{mode:'wizard'|'apply'|'repair'|'show', scope:'global'|'project',
 *   projectPath?:string, storage?:string, harness:string, yes:boolean,
 *   enable:boolean} | {error:string}}
 */
export function parseInitArgs(argv) {
  const out = {
    scope: 'global',
    projectPath: undefined,
    storage: undefined,
    harness: 'claude', // default; 'grok' also supported (wiring uses claude compat paths which Grok honors)
    yes: false,
    enable: false,
  }
  const modeFlags = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case '--global':
        out.scope = 'global'
        modeFlags.push('global')
        break
      case '--project':
        out.scope = 'project'
        modeFlags.push('project')
        break
      case '--repair':
        modeFlags.push('repair')
        break
      case '--show':
        modeFlags.push('show')
        break
      case '--yes':
        out.yes = true
        break
      case '--enable':
        out.enable = true
        break
      case '--path':
        out.projectPath = argv[++i]
        break
      case '--storage':
        out.storage = argv[++i]
        break
      case '--harness':
        out.harness = argv[++i]
        break
      default:
        return { error: `unknown flag ${a}` }
    }
  }
  const uniqueModes = [...new Set(modeFlags)]
  if (uniqueModes.length > 1) return { error: `cannot combine --${uniqueModes.join(' and --')}` }
  if (uniqueModes[0] === 'repair') out.mode = 'repair'
  else if (uniqueModes[0] === 'show') out.mode = 'show'
  else if (argv.some((a) => DECISIVE.has(a))) out.mode = 'apply'
  else out.mode = 'wizard'
  return out
}

// ── runWizard — interactive, injectable streams ─────────────────────────────

// Ask a numbered menu question; Enter accepts the default; one invalid entry
// asks again, a second invalid entry silently takes the default.
async function choose(rl, output, header, options, defaultIdx) {
  output.write(`  ${header}\n`)
  for (const [i, o] of options.entries()) output.write(`    ${i + 1}) ${o}\n`)
  const promptText = `  choose [${defaultIdx + 1}]: `
  const parse = (s) => {
    if (s === '') return defaultIdx
    const n = Number(s)
    return Number.isInteger(n) && n >= 1 && n <= options.length ? n - 1 : null
  }
  let idx = parse((await rl.question(promptText)).trim())
  if (idx === null) {
    output.write('  invalid choice — try again\n')
    idx = parse((await rl.question(promptText)).trim())
    if (idx === null) idx = defaultIdx
  }
  return idx
}

/**
 * Run the interactive wizard on injectable streams (real TTY in prod,
 * stream.PassThrough in tests). Returns the same shape as parseInitArgs.
 * @param {{input: NodeJS.ReadableStream, output: NodeJS.WritableStream, cwd: string, defaults?: object}} opts
 */
export async function runWizard({ input, output, cwd, defaults = {} }) {
  const rl = readline.createInterface({ input, output })
  try {
    output.write('sage init\n')

    const scopeIdx = await choose(
      rl,
      output,
      'Scope',
      ['Global (recommended) — every repo, enable per-project', 'This project only'],
      defaults.scope === 'project' ? 1 : 0,
    )
    const scope = scopeIdx === 0 ? 'global' : 'project'

    const harnessOptions = [
      'claude',
      'grok',
      'Both — Claude Code + Grok CLI (recommended for mixed fleets)',
    ]
    const harnessIdx = await choose(rl, output, 'Harness', harnessOptions, 0)
    let harness = harnessOptions[harnessIdx]
    if (harness.startsWith('Both')) harness = 'both'

    let storage
    let projectPath
    if (scope === 'project') {
      projectPath = cwd
      const storageIdx = await choose(
        rl,
        output,
        'Storage',
        [
          '<repo>/.agentic-sage (default)',
          'sibling (../.agentic-sage)',
          'agent-home (~/.claude/agentic-sage or ~/.grok equivalent via compat)',
        ],
        0,
      )
      storage = ['repo-root', 'sibling', 'agent-home'][storageIdx]
    } else {
      const storageIdx = await choose(
        rl,
        output,
        'Storage',
        ['~/.claude/agentic-sage (default; works for Grok via compat)', 'custom path'],
        0,
      )
      if (storageIdx === 1) {
        const p = (await rl.question('  path: ')).trim()
        if (p) storage = p
      }
    }

    const enableIdx = await choose(rl, output, 'Enable now', ['No, stay OFF (default)', 'Yes'], 0)
    const enable = enableIdx === 1

    return { mode: 'apply', scope, projectPath, storage, harness, yes: true, enable }
  } finally {
    rl.close()
  }
}

// ── renderers ────────────────────────────────────────────────────────────

const abbreviateHome = (p, home) =>
  home && typeof p === 'string' && p.startsWith(home) ? `~${p.slice(home.length)}` : p

/**
 * The clean 4-line install summary (design-approved exact shape).
 * @param {{scope:'global'|'project', enabled:boolean, dataDir:string, home:string, harness?:string}} opts
 */
export function renderSummary({ scope, enabled, dataDir, home, harness = 'claude' }) {
  const storage = abbreviateHome(dataDir, home)
  const status = enabled ? 'ENABLED' : 'DISABLED'
  const next =
    scope === 'project'
      ? enabled
        ? 'sage doctor   ·   sage board'
        : 'sage enable   ·   sage doctor'
      : enabled
        ? 'sage doctor   ·   sage board'
        : 'sage on   ·   sage doctor'
  const h = harness || 'claude'
  const harnessNote = h === 'both' ? ' (claude + grok)' : h !== 'claude' ? ` (${h})` : ''
  return [
    `✓ SAGE wired · ${scope} · ${status}${harnessNote}`,
    `  storage  ${storage}`,
    `  next     ${next}`,
    `  details  sage init --show`,
  ].join('\n')
}

// Explain a precedence rule name with the file/env var that decided it —
// shared by renderShow and `sage where` so the two stay in lockstep.
export function formatRuleDetail(rule, { home, mainRoot } = {}) {
  switch (rule) {
    case 'env':
      return 'env (SAGE_STORAGE_ROOT)'
    case 'marker':
      return `marker (${path.join(mainRoot || '<repo>', MARKER_DIR, 'config.json')})`
    case 'registry':
      return `registry (${registryPath(home)})`
    case 'default-root':
      return 'default-root (global config defaultRoot)'
    case 'built-in':
      return 'built-in (default)'
    case 'legacy':
      return `legacy (${legacySageHome(home)} — run \`sage init --repair\` to migrate)`
    default:
      return rule
  }
}

/**
 * The full path breakdown — grouped, plain text, read-only (writes nothing).
 * @param {{home:string, cwd:string}} opts
 */
export function renderShow({ home, cwd, harness = 'claude' }) {
  const profile = getHarness(harness) || getHarness('claude')
  const repo = cwd ? resolveRepo(cwd) : null
  // explainRepoDataDir's built-in-default rule needs an id (from mainRoot or
  // repoId) to join a path — with neither (no repo in cwd) it would throw;
  // fall back to the agent-home root itself, which is what a repo-less
  // context is meaningfully asking about anyway.
  const dataInfo = repo
    ? explainRepoDataDir({ home, mainRoot: repo.root, repoId: repo.id })
    : { dir: sageHome(home), rule: 'built-in', scope: 'global' }

  // New hook name wins; falls back to the legacy (pre-rename) name so an
  // un-repaired old install still shows its actual link instead of "not linked".
  const hooksLinkNew = path.join(profile.hooksDir(home), 'agentic-sage-emit.mjs')
  const hooksLinkLegacy = path.join(profile.hooksDir(home), 'sage-emit.mjs')
  let hooksLink = hooksLinkNew
  let hookTarget = 'not linked'
  try {
    hookTarget = fs.readlinkSync(hooksLinkNew)
  } catch {
    try {
      hookTarget = fs.readlinkSync(hooksLinkLegacy)
      hooksLink = hooksLinkLegacy
    } catch {
      /* not linked */
    }
  }

  const g = readJson(globalConfig(home))
  const globalState = g && g.enabled === true ? 'enabled' : 'disabled'
  let repoState = 'not set (inherits scope default)'
  if (repo) {
    const r = readJson(repoConfig(home, repo.id))
    if (r && typeof r.enabled === 'boolean') repoState = r.enabled ? 'enabled' : 'disabled'
  }
  let optOut = 'none'
  if (cwd) {
    try {
      if (fs.existsSync(path.join(cwd, '.sage-ignore'))) optOut = '.sage-ignore present'
    } catch {
      /* ignore */
    }
  }

  return [
    'SAGE — full breakdown',
    '  Scope',
    repo
      ? `    repo       ${path.basename(repo.root)} (${repo.id})`
      : '    repo       not a git repo',
    `    scope      ${dataInfo.scope}`,
    '  Harness',
    ...(harness === 'both'
      ? [
          `    claude     ${getHarness('claude').settings(home)}`,
          `    grok       ${getHarness('grok').hooksDir(home)}/agentic-sage.json`,
        ]
      : [
          `    ${harness || 'claude'}     settings ${profile.settings(home)}`,
          `    hooks      ${hooksLink} -> ${hookTarget}`,
          `    skills     ${profile.skillsDir(home)}`,
        ]),
    '  Storage',
    `    data dir   ${dataInfo.dir}`,
    `    matched    ${formatRuleDetail(dataInfo.rule, { home, mainRoot: repo?.root })}`,
    `    registry   ${registryPath(home)}`,
    `    config     ${globalConfig(home)}`,
    '  Enablement',
    `    global     ${globalState}`,
    `    repo       ${repoState}`,
    `    opt-out    ${optOut}`,
  ].join('\n')
}
