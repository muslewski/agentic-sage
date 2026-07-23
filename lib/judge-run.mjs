// sage judge run — resolve scope/harness, seed session, spawn agent or run
// fact-only keeper loop. Zero LLM in this module.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { mergeRecord, readRecord, readJson } from './store.mjs'
import { globalConfig } from './paths.mjs'
import { resolveRepoId } from './repo-id.mjs'
import { collectFleet } from './fleet.mjs'
import { gitSignals } from './git.mjs'
import {
  slotHolder,
  markBriefStale,
  briefPathFor,
  normalizeBrief,
  writeBriefFile,
  DEFAULT_TTL_MS,
  DEFAULT_GRACE_MS,
  loadAttachableBriefs,
  isBriefFresh,
  isBriefInGrace,
  isJudge,
} from './brief.mjs'
import { resolveSelfSid } from './self.mjs'

const LIVE = new Set(['working', 'idle', 'stalled'])

export const readJudgeConfig = (home = os.homedir()) => {
  const g = readJson(globalConfig(home)) || {}
  const j = g.judge && typeof g.judge === 'object' ? g.judge : {}
  return {
    harness: typeof j.harness === 'string' ? j.harness : 'auto',
    scope: typeof j.scope === 'string' ? j.scope : 'auto',
    commands: {
      grok: j.commands?.grok || 'grok',
      claude: j.commands?.claude || 'claude',
    },
    args: {
      grok: Array.isArray(j.args?.grok) ? j.args.grok : [],
      claude: Array.isArray(j.args?.claude) ? j.args.claude : [],
    },
  }
}

/** Fleet if ≥2 repos in roll-up that have any live session; else repo. */
export const resolveJudgeScope = (home, cwd, { force, now = Date.now() } = {}) => {
  if (force === 'fleet' || force === 'repo') return force
  const repoId = resolveRepoId(cwd)
  try {
    const fleet = collectFleet(home, now)
    const liveRepos = (fleet.repos || []).filter((r) =>
      (r.sessions || []).some((s) => LIVE.has(s.liveness)),
    )
    if (liveRepos.length >= 2) return 'fleet'
    // Multi-repo desk with only one live: still prefer fleet if many judged repos
    if ((fleet.totals?.repos || 0) >= 3 && liveRepos.length >= 1) return 'fleet'
  } catch {
    /* fall through */
  }
  return repoId ? 'repo' : 'fleet'
}

const which = (cmd) => {
  try {
    const out = execFileSync('sh', ['-c', `command -v ${JSON.stringify(cmd)}`], {
      encoding: 'utf8',
    }).trim()
    return out || null
  } catch {
    return null
  }
}

/** Resolve harness name + binary path. Returns { name, bin, args } or { name:'none' }. */
export const resolveHarness = (cfg, force) => {
  const want = force && force !== 'auto' ? force : cfg.harness || 'auto'
  if (want === 'none') return { name: 'none', bin: null, args: [] }
  if (want === 'grok' || want === 'claude') {
    const bin = which(cfg.commands[want] || want)
    if (!bin) return { name: want, bin: null, args: cfg.args[want] || [], missing: true }
    return { name: want, bin, args: cfg.args[want] || [] }
  }
  // auto
  for (const name of ['grok', 'claude']) {
    const bin = which(cfg.commands[name] || name)
    if (bin) return { name, bin, args: cfg.args[name] || [] }
  }
  return { name: 'none', bin: null, args: [], fallback: true }
}

export const seedJudgeSession = (home, repoId, sid, cwd, scope, { pid = process.pid } = {}) => {
  const sig = gitSignals(cwd) || {}
  let branch = null
  try {
    branch = execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    /* ignore */
  }
  const prev = readRecord(home, repoId, sid)
  mergeRecord(home, repoId, sid, {
    session_id: sid,
    repo_id: repoId,
    worktree: cwd,
    branch: branch || null,
    head: sig.head ?? null,
    dirty: !!sig.dirty,
    touched_globs: sig.touched || [],
    trunk: sig.trunk ?? null,
    pid,
    status: 'active',
    link_state: 'linked',
    role: 'judge',
    judge_scope: scope,
    judge_at: new Date().toISOString(),
    source: prev?.source || 'judge-run',
    managed_by: 'human',
    agent_kind: 'unknown',
    opened_at: prev?.opened_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_tool_at: new Date().toISOString(),
    last_prompt_at: new Date().toISOString(),
  })
  return sid
}

export const ensureJudgeSlot = (home, scope, repoId, sid, { takeover = false, now = Date.now() } = {}) => {
  const holder = slotHolder(home, scope, repoId, { now })
  if (holder && holder.judge_sid !== sid) {
    if (!takeover) {
      return {
        ok: false,
        message: `sage: ${scope} judge slot held by ${holder.judge_sid} — re-run with --takeover`,
      }
    }
    markBriefStale(home, scope, scope === 'repo' ? repoId : null)
  }
  return { ok: true }
}

/** Fact-only brief from fleet snapshot (no LLM). */
export const buildFactBrief = (home, scope, repoId, sid, { now = Date.now() } = {}) => {
  let live = 0
  let contested = 0
  let summary = ''
  let analysis = ''
  try {
    const fleet = collectFleet(home, now)
    live = fleet.totals?.live || 0
    contested = fleet.totals?.contested || 0
    const judges = fleet.totals?.judges || 0
    if (scope === 'fleet') {
      summary = `Fleet: ${live} live · ${contested} ⚔ · ${fleet.totals?.repos || 0} repos`
      analysis = `Fact brief (harness none). Working=${fleet.totals?.working || 0}, nested=${fleet.totals?.nested || 0}, judges=${judges}. Advisory only — surface dual-live collisions to the human.`
    } else {
      const row = (fleet.repos || []).find((r) => r.repoId === repoId)
      const n = (row?.sessions || []).filter((s) => LIVE.has(s.liveness) && !isJudge(s)).length
      summary = `Repo ${repoId}: ${n} live workers`
      analysis = `Fact brief for this repo. Contested paths across fleet: ${contested}. Prefer CLI territory/merge-brief for path truth.`
    }
  } catch {
    summary = `${scope} judge (fact brief)`
    analysis = 'Could not collect fleet; retry next cycle.'
  }
  return normalizeBrief(
    {
      scope,
      repo_id: scope === 'repo' ? repoId : null,
      judge_sid: sid,
      judge_repo_id: repoId,
      judge_pid: process.pid,
      status: 'active',
      summary,
      analysis,
      confidence: 'medium',
      advice: [
        {
          audience: 'workers',
          text: 'Trust CLI contested/clear; this brief is fact-derived only',
        },
        { audience: 'human', text: 'Run sage judge run --harness grok for richer narrative' },
      ],
      inputs: { live, contested, sources: ['war', 'collectFleet'] },
      ttl_ms: DEFAULT_TTL_MS,
      grace_ms: DEFAULT_GRACE_MS,
    },
    { now },
  )
}

export const publishFactBrief = (home, scope, repoId, sid) => {
  const brief = buildFactBrief(home, scope, repoId, sid)
  writeBriefFile(briefPathFor(home, scope, repoId), brief)
  return brief
}

export const judgePromptText = (scope) =>
  [
    'You are a SAGE live fleet judge (passive advisor).',
    `Scope: ${scope}.`,
    'Loop until the human stops you:',
    '1) Run: sage war --json  (and sage fleet --json / merge-brief as needed)',
    '2) Reason about live sessions and collisions — do NOT pick winners.',
    '3) Publish: sage judge publish <<EOF ... JSON with summary, analysis, confidence, advice[] ... EOF',
    '4) Sleep 30–60s and repeat.',
    'Rules: no sage claim on product globs; no guard on; no product-tree edits.',
    'Start with: sage judge status',
  ].join('\n')

/**
 * Chrome summary for war / statusline.
 * @returns {{ judges: number, fleet: boolean, repo: number, grace: boolean, label: string }}
 */
export const summarizeJudgeChrome = (home, fleet, { now = Date.now() } = {}) => {
  const judges = fleet?.totals?.judges || 0
  let fleetLive = false
  let fleetGrace = false
  try {
    const { fleet: fb } = loadAttachableBriefs(home, null, { now })
    if (fb) {
      fleetLive = isBriefFresh(fb, { now, home })
      fleetGrace = isBriefInGrace(fb, { now, home })
    }
  } catch {
    /* ignore */
  }
  let repoBriefs = 0
  for (const r of fleet?.repos || []) {
    try {
      const { repo } = loadAttachableBriefs(home, r.repoId, { now })
      if (repo) repoBriefs++
    } catch {
      /* ignore */
    }
  }
  const grace = fleetGrace || (judges === 0 && (fleetLive || repoBriefs > 0))
  const parts = []
  if (judges > 0) parts.push(`${judges} live`)
  if (fleetLive) parts.push(fleetGrace ? 'fleet·grace' : 'fleet')
  else if (repoBriefs) parts.push(`${repoBriefs} repo brief${repoBriefs > 1 ? 's' : ''}`)
  const label =
    judges > 0 || fleetLive || repoBriefs > 0
      ? `⚖ ${parts.join(' · ') || 'judge'}`
      : ''
  return {
    judges,
    fleet: fleetLive,
    repo: repoBriefs,
    grace: !!(grace && judges === 0),
    label,
  }
}

/** Run fact-only publish loop. Returns when done (once or seconds). */
export const runNoneKeeper = async (home, scope, repoId, sid, cwd, { once = false, seconds = 3600 } = {}) => {
  seedJudgeSession(home, repoId, sid, cwd, scope)
  const end = Date.now() + seconds * 1000
  let n = 0
  do {
    n++
    seedJudgeSession(home, repoId, sid, cwd, scope) // refresh pid/liveness
    const b = publishFactBrief(home, scope, repoId, sid)
    console.log(`sage: published ${scope} fact brief #${n} — ${b.summary}`)
    if (once) break
    await new Promise((r) => setTimeout(r, 15_000))
  } while (Date.now() < end)
}

export const printOnlyKit = ({ scope, harness, sid, repoId }) => {
  const lines = [
    `sage: judge run kit · scope=${scope} · harness=${harness.name} · sid=${sid}`,
    `  export SAGE_SELF_SID=${sid}`,
    `  export SAGE_JUDGE_SCOPE=${scope}`,
    repoId ? `  # repo_id=${repoId}` : '',
    `  sage judge on --${scope} --takeover`,
    `  # then load skill sage-judge, or:`,
    `  sage judge run --harness none --once   # fact-only publish`,
    '',
    'Prompt for your agent:',
    judgePromptText(scope),
  ].filter(Boolean)
  return lines.join('\n')
}

const sageBin = () => path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'sage')

/**
 * Spawn harness with env. Returns child process or null if print/missing.
 */
export const spawnHarnessJudge = (home, { scope, repoId, sid, cwd, harness, takeover }) => {
  const slot = ensureJudgeSlot(home, scope, repoId, sid, { takeover })
  if (!slot.ok) {
    console.log(slot.message)
    return null
  }
  seedJudgeSession(home, repoId, sid, cwd, scope)
  // Also run judge on via CLI for consistency
  spawnSync(process.execPath, [sageBin(), 'judge', 'on', `--${scope}`, ...(takeover ? ['--takeover'] : [])], {
    cwd,
    env: { ...process.env, HOME: home, SAGE_SELF_SID: sid },
    encoding: 'utf8',
  })

  if (harness.name === 'none' || !harness.bin) {
    return { mode: 'none' }
  }

  const env = {
    ...process.env,
    HOME: home,
    SAGE_SELF_SID: sid,
    SAGE_JUDGE_SCOPE: scope,
    SAGE_ROLE: 'judge',
  }
  const prompt = judgePromptText(scope)
  // Best-effort: many CLIs accept a trailing prompt; user can also paste skill.
  const args = [...(harness.args || [])]
  // Prefer leaving prompt in a temp file for agents that read it
  const promptPath = path.join(os.tmpdir(), `sage-judge-${sid}.md`)
  try {
    fs.writeFileSync(promptPath, `# SAGE live judge\n\n${prompt}\n`)
  } catch {
    /* ignore */
  }
  console.log(
    `sage: starting ${harness.name} as live judge (${scope})\n` +
      `  sid ${sid}\n` +
      `  prompt file: ${promptPath}\n` +
      `  (load skill sage-judge if the CLI does not take a file)`,
  )
  const child = spawn(harness.bin, args, {
    cwd,
    env,
    stdio: 'inherit',
  })
  return { mode: 'spawn', child, promptPath }
}
