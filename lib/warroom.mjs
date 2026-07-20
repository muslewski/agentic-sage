// The war-room cockpit renderers — pure, plain-text (color applied downstream
// at the bin/sage chokepoint, exactly like lib/board.mjs). Consumes the fleet
// shape from lib/fleet.mjs; emits a fixed-region frame: header + 3 stat panels
// + a scrollable session body + a footer. Working rows lead with ◆ so the shell
// can animate them by swapping ◆ → spinner frame (spinnerizeWar), scroll-proof.
import { zoneOf } from './board.mjs'
import { isNested } from './fleet.mjs'

const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
export const sparkline = (values = []) => {
  const v = values.filter((x) => Number.isFinite(x))
  if (!v.length) return ''
  const max = Math.max(...v, 1)
  return v
    .map((x) => SPARK[Math.min(SPARK.length - 1, Math.round((x / max) * (SPARK.length - 1)))])
    .join('')
}

const padR = (s, n) => String(s ?? '').padEnd(n)
const stripAgo = (s) => String(s || '').replace(/\s*ago$/, '')

// Shorten to `n` display cols with a MIDDLE ellipsis, so both ends survive: a
// branch keeps its category prefix (docs/, feat/) AND its feature tail — and the
// ✎ dirty marker, which sits at the tail. No padding (see fit). Codepoint-safe.
export const clip = (s, n) => {
  const chars = [...String(s ?? '')]
  if (chars.length <= n) return chars.join('')
  if (n <= 1) return chars.slice(0, Math.max(0, n)).join('')
  const head = Math.ceil((n - 1) / 2)
  const tail = n - 1 - head
  return `${chars.slice(0, head).join('')}…${tail ? chars.slice(-tail).join('') : ''}`
}

// Keep the TAIL of a string in `n` display cols, dropping the head behind a
// leading … . For zone paths the deepest dir is the informative part; clip()'s
// middle ellipsis (right for branch ids) drops the leading char and reads as
// garbage. Codepoint-safe. No padding (see fitZone/fit).
export const clipLeft = (s, n) => {
  const chars = [...String(s ?? '')]
  if (chars.length <= n) return chars.join('')
  if (n <= 1) return chars.slice(-Math.max(0, n)).join('')
  return `…${chars.slice(-(n - 1)).join('')}`
}

// clip THEN pad to exactly `n` cols → a rigid grid: every column starts at the
// same screen x no matter how long the content is. This is the list-taming fix.
export const fit = (s, n) => padR(clip(s, n), n)
// Zone paths overflow with left-ellipsis (keep the deepest dir tail). When a
// trailing " +N" glob-overflow count is present, clip only the path and keep
// +N adjacent, then pad the whole to `n`. Bare long paths (no +N) also use
// clipLeft — middle-ellipsis would drop the leading chars of useful path tails.
export const fitZone = (s, n) => {
  const str = String(s ?? '')
  if ([...str].length <= n) return fit(str, n)
  const m = str.match(/ \+\d+$/)
  if (!m) return fit(clipLeft(str, n), n)
  const path = clipLeft(str.slice(0, -m[0].length), Math.max(1, n - [...m[0]].length))
  return fit(path + m[0], n)
}

// One rounded box, `w` TOTAL display columns wide. Every line is exactly `w`
// columns: top `╭─ TITLE ─…╮`, each body `│ …│`, bottom `╰─…╯`. Panel content is
// ASCII + block-sparkline (all width-1), so string length == display width here.
const box = (title, rows, w) => {
  const label = `─ ${title} ` // e.g. "─ FLEET "
  const top = `╭${label}${'─'.repeat(Math.max(0, w - 2 - label.length))}╮` // ╭+inner(w-2)+╮
  const body = rows.map((r) => `│ ${padR(r, w - 3)}│`) // │+space+content(w-3)+│ = w
  const bot = `╰${'─'.repeat(Math.max(0, w - 2))}╯`
  return [top, ...body, bot]
}

const W_FLEET = 15
const W_ACTIVE = 15
const W_HEAT = 26
export const PANEL_W = W_FLEET + W_ACTIVE + W_HEAT // total cockpit width (56)

// Three side-by-side panels as one 4-line block. The HEAT sparkline is capped to
// the last 12 samples so a growing ring buffer never overflows the panel.
export const renderPanels = (totals = {}, heatValues = []) => {
  // Face-aware panel copy (LIVE default; CLASH/MEMORY pass tagged totals).
  const t = {
    repos: 0,
    sessions: 0,
    live: 0,
    working: 0,
    contested: 0,
    compacting: 0,
    human: 0,
    nested: 0,
    paths: 0,
    dead: 0,
    ...totals,
  }
  const human = Number.isFinite(t.human)
    ? t.human
    : Math.max(0, (t.live || 0) - (t.nested || 0))
  const spark = sparkline(heatValues.slice(-12))

  if (t._clash) {
    const fleet = box('CLASH', [`${t.repos} repos`, `${t.paths || t.contested || 0} paths`], W_FLEET)
    const active = box('INVOLVED', [`${t.sessions || 0} sess`, `${t.working || 0} hot`], W_ACTIVE)
    const heat = box('HEAT', [`${spark ? `${spark}  ` : ''}${t.paths || t.contested || 0} ⚔`, t.paths || t.contested ? 'live only' : 'clear'], W_HEAT)
    return fleet.map((ln, i) => ln + active[i] + heat[i]).join('\n')
  }
  if (t._memory) {
    const dead = t.dead || t.sessions || 0
    const ghosts = t.ghosts || 0
    const fleet = box('MEMORY', [`${t.repos} repos`, `${dead} dead`], W_FLEET)
    const active = box('ARCHIVE', [`${dead} records`, ghosts ? `${ghosts} ghosts` : 'terminal'], W_ACTIVE)
    const heat = box('CLEAN', ['X clear all', 'm kill one'], W_HEAT)
    return fleet.map((ln, i) => ln + active[i] + heat[i]).join('\n')
  }

  const fleet = box('FLEET', [`${t.repos} repos`, `${human} human`], W_FLEET)
  const active = box('ACTIVE', [`${t.live} live`, `${t.nested || 0} nested`], W_ACTIVE)
  const heatBits = []
  if (t.compacting > 0) heatBits.push(`${t.compacting} compact`)
  if (t.contested > 0) heatBits.push(`${t.contested} ⚔`)
  const heatLine2 = heatBits.length ? heatBits.join(' · ') : 'clear'
  const heat = box(
    'HEAT',
    [`${spark ? `${spark}  ` : ''}${t.working} hot`, heatLine2],
    W_HEAT,
  )
  return fleet.map((ln, i) => ln + active[i] + heat[i]).join('\n')
}

// Terminal session (no longer collision-relevant).
const TERMINAL = new Set(['dead', 'closed'])
export const isTerminal = (s) => TERMINAL.has(s?.liveness)

// A ghost never spoke and never tool'd — /clear residue or abandoned spawn.
export const isGhostSession = (s) =>
  isTerminal(s) && !s?.last_prompt_at && !s?.last_tool_at

// Fold dead noise for the human eye. Live rows always pass through.
// Among terminal sessions with real activity, keep the newest per
// (worktree, branch); pure ghosts never get a row — only a count.
// Pure; order of live rows preserved; kept terminal appended by recency.
export const collapseChurn = (sessions = []) => {
  const live = []
  const terminal = []
  for (const s of sessions) {
    if (isTerminal(s)) terminal.push(s)
    else live.push(s)
  }
  let ghosts = 0
  const byKey = new Map()
  for (const s of terminal) {
    if (isGhostSession(s)) {
      ghosts++
      continue
    }
    const key = `${s.worktree || ''}\0${s.branch || ''}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, s)
      continue
    }
    const ta = Date.parse(s.updated_at || '') || 0
    const tb = Date.parse(prev.updated_at || '') || 0
    if (ta >= tb) byKey.set(key, s)
  }
  const kept = [...byKey.values()].sort((a, b) =>
    String(b.updated_at || '').localeCompare(String(a.updated_at || '')),
  )
  const churn = Math.max(0, terminal.length - ghosts - kept.length)
  return { sessions: live.concat(kept), ghosts, churn }
}

// Responsive column layout. CRITICAL: rowW MUST be ≤ terminal cols.
// Default grid: NAME | BRANCH | STATUS | ZONE | AGE — zone on by default
// (enough room at ≥80 cols; `z` toggles off for a denser roster).
// layoutFor is pure on (cols, showZone) but was recomputed once PER ROW inside
// sessionRow (and per band) on every model rebuild — hundreds of identical
// ~30-line arithmetic passes per repaint. Memoize on the two inputs; the key
// space is tiny (a handful of terminal widths × 2). L is treated as read-only
// by every caller, so sharing the frozen result is safe.
const _layoutMemo = new Map()
export const layoutFor = (cols, { showZone = true } = {}) => {
  const key = `${cols}|${showZone ? 1 : 0}`
  const hit = _layoutMemo.get(key)
  if (hit) return hit
  const L = computeLayout(cols, showZone)
  if (_layoutMemo.size > 256) _layoutMemo.clear()
  _layoutMemo.set(key, L)
  return L
}
const computeLayout = (cols, showZone) => {
  const term = Number.isFinite(cols) && cols >= 40 ? Math.floor(cols) : 80
  // 4 cells default (+ ZONE when on) → n-1 rules
  const nData = showZone ? 5 : 4
  const rules = nData - 1
  const fixed = 4 + rules * 3 // "  ● " gutter + │ rules
  let pool = Math.max(28, term - fixed)
  const status = pool >= 70 ? 11 : 10
  const when = 6
  const meta = pool >= 100 ? 5 : 0
  pool -= status + when + meta
  let zone = 0
  if (showZone) {
    zone = Math.min(12, Math.max(8, Math.floor(pool * 0.22)))
    pool -= zone
  }
  // NAME short (tmux window); BRANCH takes the rest (git refs are longer).
  let name = Math.max(8, Math.min(16, Math.floor(pool * 0.36)))
  let branch = Math.max(8, pool - name)
  // Guarantee rowW ≤ term even on narrow panes (pool floors can overshoot).
  let rowW = fixed + name + branch + status + zone + when + meta
  if (rowW > term) {
    branch = Math.max(6, branch - (rowW - term))
    rowW = fixed + name + branch + status + zone + when + meta
  }
  if (rowW > term) {
    name = Math.max(6, name - (rowW - term))
    rowW = fixed + name + branch + status + zone + when + meta
  }
  if (rowW > term) {
    // Last resort: shrink status (still ≥ 8 for "working")
    const drop = rowW - term
    const status2 = Math.max(8, status - drop)
    rowW = fixed + name + branch + status2 + zone + when + meta
    return { name, branch, status: status2, zone, when, meta, rowW, showZone: !!showZone, term }
  }
  return { name, branch, status, zone, when, meta, rowW, showZone: !!showZone, term }
}
// Defaults for tests / non-TTY (80-col balanced baseline).
export const COL = layoutFor(80)
export const ROW_W = COL.rowW

// Compact handoff cell: age only ("4m","1h","now") — never "fresh 1h ago".
export const handoffCell = (s) => {
  if (!s || s.handoff_bucket === 'none' || !s.handoff_bucket) return ''
  const age = stripAgo(s.handoff_age || '')
  if (!age || age === '—') return ''
  if (age === 'just now') return 'now'
  return age
}

// NAME cell: tmux window if set, else a quiet placeholder (branch lives next door).
export const nameCell = (s) => {
  const win = (s?.window_name || '').trim()
  return win || '·'
}

// BRANCH cell: git branch (always its own column — fills the old NAME desert).
export const branchCell = (s) => s?.branch || '(none)'

// One session row. Default: NAME | BRANCH | STATUS | ZONE | AGE.
// Dirty mark sits on NAME (or BRANCH if NAME is placeholder).
export const sessionRow = (s, { wide, cols, showZone = true } = {}) => {
  const L = layoutFor(cols, { showZone })
  const isHot = s.liveness === 'working' || s.phase === 'compacting'
  const lead = isHot ? '◆' : '●'
  const win = nameCell(s)
  const br = branchCell(s)
  const dirty = s.dirty ? ' ✎' : ''
  // Prefer dirty on the real name; if placeholder, hang it on branch.
  const nameStr = win === '·' ? win : `${win}${dirty}`
  const branchStr = win === '·' ? `${br}${dirty}` : br
  const pct =
    s.ctx_used && s.ctx_window ? `${Math.round((s.ctx_used / s.ctx_window) * 100)}%` : ''
  const dead = s.liveness === 'dead' || s.liveness === 'closed'
  const when = handoffCell(s)
  const meta = L.meta > 0 ? `${s.row ? `↳${s.row}` : ''}${dead && s.row ? '⚠' : ''}` : ''
  const idw = wide
    ? `  ${String(s.session_id || '').slice(0, 8)}${s.tmux ? ` @${s.tmux}` : ''}`
    : ''
  const baseStatus = s.phase === 'compacting' ? 'compact' : s.liveness
  const withPct = pct ? `${baseStatus} ${pct}` : baseStatus
  const status = [...withPct].length <= L.status ? withPct : baseStatus
  const metaPad = L.meta > 0 ? fit(meta, L.meta) : ''
  const cells = [
    `  ${lead} ${fit(nameStr, L.name)}`,
    fit(branchStr, L.branch),
    fit(status, L.status),
    ...(L.showZone ? [fitZone(zoneOf(s.touched_globs), L.zone)] : []),
    fit(when, L.when) + metaPad,
  ]
  return cells.join(' │ ') + idw
}

// Sessions shown in the body for a repo (Layer B: hide nested by default).
// Nested filter only — churn collapse is applied by prepareRepoView.
export const visibleSessions = (repo, { showNested = false } = {}) => {
  const all = repo.sessions || []
  return showNested ? all : all.filter((s) => !isNested(s))
}

// Nested filter + ghost//clear collapse → the rows the human actually sees.
export const prepareRepoView = (repo, { showNested = false } = {}) => {
  const base = visibleSessions(repo, { showNested })
  const { sessions, ghosts, churn } = collapseChurn(base)
  return { sessions, ghosts, churn }
}

// Pin a repo band to exactly `width` display cols: left label + right rollup.
// Long rollups (ghosts/churn) shrink the left via middle-ellipsis rather than
// wrapping and shoving the whole cockpit frame around.
export const fitBand = (left, bits = [], width = PANEL_W) => {
  const w = Math.max(8, width)
  const roll = bits.length ? `· ${bits.join(' · ')}` : ''
  if (!roll) return padR(clip(String(left ?? ''), w), w)
  const rollChars = [...roll]
  // Prefer the full rollup on the right; clip the left label to fit.
  const maxLeft = Math.max(4, w - 1 - Math.min(rollChars.length, w - 5))
  const L = clip(String(left ?? ''), maxLeft)
  const rollFit = rollChars.length <= w - [...L].length - 1 ? roll : clip(roll, w - [...L].length - 1)
  const gap = Math.max(1, w - [...L].length - [...rollFit].length)
  const out = L + ' '.repeat(gap) + rollFit
  const chars = [...out]
  if (chars.length === w) return out
  if (chars.length < w) return out + ' '.repeat(w - chars.length)
  return chars.slice(0, w).join('')
}

// A repo is a parent BAND over its session rows: a left-margin accent bar ▌ +
// bright name (skinned in color.mjs), and a right-aligned "· N hot" / nested
// / ghosts / churn rollup. Layer B: human rows listed; nested folded until
// showNested; terminal ghosts never get their own rows.
export const renderRepoSection = (
  repo,
  { wide, showNested = false, cols, showZone = true, view } = {},
) => {
  const all = repo.sessions || []
  const nestedN = Number.isFinite(repo.nested) ? repo.nested : all.filter(isNested).length
  // Accept a precomputed view so bodyModel (which also needs the sessions) does
  // not run collapseChurn twice per repo on every rebuild.
  const { sessions, ghosts, churn } = view || prepareRepoView(repo, { showNested })
  const n = sessions.length
  // Calm band: label + count only. No "· N hot" — heat lives in the panels/STATUS.
  const left = `▌ ${repo.label} · ${n}`
  const bits = []
  if (nestedN > 0 && !showNested) bits.push(`+${nestedN} nested`)
  if (ghosts > 0) bits.push(`+${ghosts} ghosts`)
  if (churn > 0) bits.push(`+${churn} churn`)
  const L = layoutFor(cols, { showZone })
  // Only full-width pad when there's a right-side rollup; otherwise leave the
  // band short so empty name-gap doesn't echo on the repo header.
  const head = bits.length ? fitBand(left, bits, L.rowW) : left
  return [head, ...sessions.map((s) => sessionRow(s, { wide, cols, showZone }))]
}

// Body as an attributed model: each entry carries its text, whether it IS a
// repo band header, and the header that GOVERNS it (a header governs itself).
// This attribution is what lets the viewport pin the right band while scrolling.
export const bodyModel = (fleet, { wide, showNested = false, cols, showZone = true } = {}) =>
  (fleet.repos || []).flatMap((r) => {
    const view = prepareRepoView(r, { showNested })
    const [head, ...rows] = renderRepoSection(r, { wide, showNested, cols, showZone, view })
    return [
      { text: head, header: head, isHeader: true, session: null },
      ...rows.map((t, i) => ({ text: t, header: head, isHeader: false, session: view.sessions[i] })),
    ]
  }) // Flat text lines (back-compat: the demo/tests + non-scrolling callers).
export const bodyLines = (fleet, opts) => bodyModel(fleet, opts).map((m) => m.text)

// A non-selectable rule separating the floated HOT group (repos with a live
// working session) from the quiet remainder on the LIVE face. isHeader:true keeps
// it out of the selectable cursor set (see warnav.selectableIndices) and out of a
// real band's sticky pin; `divider:true` tags it for anyone who must skip it.
export const dividerEntry = (cols, { showZone = true, label = ' quiet ' } = {}) => {
  const w = layoutFor(cols, { showZone }).rowW
  const text = `──${label}${'─'.repeat(Math.max(0, w - 2 - [...label].length))}`
  return { text, header: text, isHeader: true, session: null, divider: true }
}

// LIVE-face body model: `view.repos` is already [hot…, quiet…] (fleet.sortFleet
// stable order → hotfloat.floatHot), split at `hotCount`. Insert the divider
// between the two groups, but only when the split is non-trivial (some hot AND
// some quiet) — otherwise it is just the plain model.
export const liveModel = (view, { hotCount = 0, cols, showZone = true, wide, showNested } = {}) => {
  const opts = { wide, showNested, cols, showZone }
  const repos = view.repos || []
  if (hotCount > 0 && hotCount < repos.length) {
    const hot = bodyModel({ repos: repos.slice(0, hotCount), totals: view.totals }, opts)
    const rest = bodyModel({ repos: repos.slice(hotCount), totals: view.totals }, opts)
    return [...hot, dividerEntry(cols, { showZone }), ...rest]
  }
  return bodyModel(view, opts)
}

// Pure clamp + slice. height non-finite or ≥ length → the whole array.
export const viewport = (lines, { scroll = 0, height } = {}) => {
  if (!Number.isFinite(height) || height >= lines.length)
    return { slice: lines, scroll: 0, maxScroll: 0 }
  const maxScroll = Math.max(0, lines.length - height)
  const s = Math.max(0, Math.min(scroll, maxScroll))
  return { slice: lines.slice(s, s + height), scroll: s, maxScroll }
}

// Mark a session row as selected: swap its two leading spaces for "❯ " (painted
// bright downstream). Only touches a leading "  ", so repo bands are left alone.
export const markSelected = (text) => (text.startsWith('  ') ? `❯ ${text.slice(2)}` : text)

// Sticky-header viewport over the attributed model. Returns the windowed rows as
// ENTRIES ({ text, modelIndex }) so the caller can mark the cursor and know the
// pinned band is synthetic (modelIndex null). Pins the governing band on row 0
// when the top visible line is a row whose header scrolled off. `selected` is a
// model index (or null); its row gets the ❯ marker.
export const stickyViewport = (model, { scroll = 0, height, selected = null } = {}) => {
  const mark = (e) =>
    e.modelIndex !== null && e.modelIndex === selected ? { ...e, text: markSelected(e.text) } : e
  if (!Number.isFinite(height) || height >= model.length) {
    return {
      rows: model.map((m, i) => mark({ text: m.text, modelIndex: i })),
      scroll: 0,
      maxScroll: 0,
      stuck: null,
    }
  }
  const maxScroll = Math.max(0, model.length - height)
  const s = Math.max(0, Math.min(scroll, maxScroll))
  const win = model.slice(s, s + height)
  const top = win[0]
  if (top && !top.isHeader) {
    const rows = [
      { text: top.header, modelIndex: null, stuck: true },
      ...win.slice(1).map((m, i) => ({ text: m.text, modelIndex: s + 1 + i })),
    ]
    return { rows: rows.map(mark), scroll: s, maxScroll, stuck: top.header }
  }
  return {
    rows: win.map((m, i) => mark({ text: m.text, modelIndex: s + i })),
    scroll: s,
    maxScroll,
    stuck: null,
  }
}

// Full key map for the help overlay. Pure list — renderHelp pads to terminal width.
export const HELP_KEYS = [
  ['← →  [ ]', 'switch face: LIVE · CLASH · MEMORY'],
  ['1 2 3', 'jump LIVE / CLASH / MEMORY'],
  ['↑↓  j k', 'move selection'],
  ['PgUp/Dn', 'page the list'],
  ['↵ Enter', 'jump into session (tmux) or print cd'],
  ['c', 'print cd path and exit'],
  ['/', 'filter within the active face'],
  ['z', 'toggle ZONE column (LIVE)'],
  ['w', 'toggle working-only (LIVE/CLASH)'],
  ['n', 'toggle nested (LIVE/MEMORY)'],
  ['a', 'show dead on LIVE (prefer MEMORY face)'],
  ['m', 'manage selected dead row (MEMORY)'],
  ['X  then y', 'clear ALL dead/closed (MEMORY)'],
  ['r', 'force refresh'],
  ['?  h', 'toggle this help'],
  ['q  esc', 'quit war · close help'],
]

// Help body lines (no chrome). Each line is clipped/padded to `width`.
export const renderHelp = (cols = 80) => {
  const w = layoutFor(cols).rowW
  const lines = [
    'SAGE WAR ROOM — help',
    '',
    'Three faces (← →): LIVE army · CLASH contests · MEMORY graveyard.',
    '',
    ...HELP_KEYS.map(([key, desc]) => {
      const k = fit(key, 12)
      return `  ${k}  ${desc}`
    }),
    '',
    'CLI (outside war): territory · claim · merge-brief · fleet',
    '',
    'Press ?  h  or  esc  to close',
  ]
  return lines.map((ln) => padR(clip(ln, w), w))
}

export const footer = (
  showAll,
  scroll = 0,
  maxScroll = 0,
  {
    mode = 'nav',
    query = '',
    workingOnly = false,
    showNested = false,
    manageLabel = '',
    confirm = false,
    confirmCount = 0,
    deadCount = 0,
    showZone = true,
    cols = 80,
    face = 'live',
    clashCount = 0, // LIVE footer hint: → CLASH N when contests exist
  } = {},
) => {
  // Every footer is labeled (key + word) and hard-capped to terminal width.
  if (confirm) return ` clear ${confirmCount} dead?  y confirm · n cancel`
  if (mode === 'help') return ` ? help · esc close`
  if (mode === 'filter') return ` / filter: ${query}▌   esc · ↵ done`
  if (mode === 'manage') {
    const who = manageLabel ? `‹${manageLabel}›` : ''
    return ` manage ${who} · k kill · X clear-all · esc`.replace(/\s+/g, ' ').trim()
  }
  const width = Number.isFinite(cols) && cols >= 40 ? Math.floor(cols) : 80
  const tail = '←→ faces · ? help · q quit'
  const tailW = [...` · ${tail}`].length
  const budget = Math.max(20, width - tailW)
  let head
  if (face === 'clash') {
    head = [
      '↑↓ move',
      '↵ open',
      '/ filter',
      workingOnly ? 'work✓' : 'work',
      'live only',
    ].filter(Boolean)
  } else if (face === 'memory') {
    head = [
      '↑↓ move',
      deadCount > 0 ? `X clear×${deadCount}` : 'X clear',
      'm manage',
      showNested ? 'nest✓' : null,
    ].filter(Boolean)
  } else {
    head = [
      '↑↓ move',
      '↵ open',
      '/ filter',
      showZone ? 'zone✓' : 'zone',
      workingOnly ? 'work✓' : null,
      showNested ? 'nest✓' : null,
      showAll ? 'all✓' : null,
      clashCount > 0 ? `2→clash ${clashCount}` : null, // 2 jumps to CLASH
    ].filter(Boolean)
  }
  let packed = ''
  for (const chip of head) {
    const next = packed ? `${packed} · ${chip}` : ` ${chip}`
    if ([...next].length > budget) break
    packed = next
  }
  const fq = query.trim() ? ` · f:${query.trim().slice(0, 8)}` : ''
  const pos = maxScroll > 0 ? ` · ${scroll}/${maxScroll}` : ''
  let line = `${packed} · ${tail}${fq}${pos}`
  if ([...line].length > width) line = [...line].slice(0, width).join('')
  return line
}

// Column-label header — NAME | BRANCH | STATUS | ZONE | AGE (zone default on)
export const columnHeader = (cols, { showZone = true } = {}) => {
  const L = layoutFor(cols, { showZone })
  const metaPad = L.meta > 0 ? fit('', L.meta) : ''
  const cells = [
    `    ${fit('NAME', L.name)}`,
    fit('BRANCH', L.branch),
    fit('STATUS', L.status),
    ...(L.showZone ? [fit('ZONE', L.zone)] : []),
    fit('AGE', L.when) + metaPad,
  ]
  return cells.join(' │ ')
}

// header(1) + panels(4) + columnHeader(1) + footer(1). The body fills the rest.
export const WAR_CHROME = 7

// Legacy header without faces (tests / non-face callers).
const headerLine = (clock, cols) => {
  const left = '⚔  SAGE WAR ROOM · fleet'
  const leftCols = left.length + 1 // ⚔ counts as 2 (one extra col over its length)
  if (!clock) return left
  const width = Math.max(leftCols + 2, Number.isFinite(cols) ? cols : PANEL_W)
  const gap = Math.max(2, width - leftCols - clock.length)
  return left + ' '.repeat(gap) + clock
}

export const renderWarRoom = (
  fleet,
  {
    showAll = false,
    heatValues = [],
    scroll = 0,
    rows = Infinity,
    cols = 80,
    wide = false,
    clock = '',
    selected = null,
    mode = 'nav',
    query = '',
    workingOnly = false,
    showNested = false,
    showZone = true,
    manageLabel = '',
    confirm = false,
    confirmCount = 0,
    deadCount = 0,
    face = 'live',
    panelTotals = null, // face-specific panel totals (from facePanelTotals)
    headerLine: headerOverride = null, // full header with tabs (from renderWarHeader)
    clashCount = 0,
    // Shell passes a prebuilt model so the 100ms paint clock never rebuilds
    // hundreds of rows — only refresh() rebuilds (see runWarWatch).
    model: prebuiltModel = null,
    hideColumnHeader = false, // CLASH uses path tree, no NAME|BRANCH header
  } = {},
) => {
  const termCols = Number.isFinite(cols) && cols > 0 && cols < 1e6 ? cols : 80
  const header = headerOverride || headerLine(clock, termCols)
  const panels = renderPanels(panelTotals || fleet.totals || {}, heatValues)
  const dead =
    deadCount > 0
      ? deadCount
      : Math.max(0, (fleet.totals?.sessions || 0) - (fleet.totals?.live || 0))
  const foot = (sc, maxScroll) =>
    footer(showAll, sc, maxScroll, {
      mode,
      query,
      workingOnly,
      showNested,
      manageLabel,
      confirm,
      confirmCount,
      deadCount: dead,
      showZone,
      cols: termCols,
      face,
      clashCount,
    })

  // Help overlay: drop panels so the full key map fits a 24-row terminal.
  // Chrome = header(1) + footer(1); body is the help text.
  if (mode === 'help') {
    const L = layoutFor(termCols, { showZone })
    const help = renderHelp(termCols)
    const helpChrome = 2 // header + footer only
    const height = Number.isFinite(rows) ? Math.max(1, rows - helpChrome) : help.length
    const slice = help.slice(0, height)
    while (slice.length < height) slice.push(padR('', L.rowW))
    return [header, ...slice, foot(0, 0)].join('\n')
  }

  const model = prebuiltModel || bodyModel(fleet, { wide, showNested, cols: termCols, showZone })
  // CLASH has no column header → body gets +1 row (chrome still 7 with a blank? )
  // Use a calm face title row instead of column headers for clash.
  const col =
    hideColumnHeader || face === 'clash'
      ? padR(clip(face === 'clash' ? '    PATHS · live contests' : '', layoutFor(termCols, { showZone }).rowW), layoutFor(termCols, { showZone }).rowW)
      : columnHeader(termCols, { showZone })
  const height = Number.isFinite(rows) ? Math.max(1, rows - WAR_CHROME) : Infinity
  const vp = stickyViewport(model, { scroll, height, selected })
  const body = vp.rows.map((r) => r.text)
  return [header, panels, col, ...body, foot(vp.scroll, vp.maxScroll)].join('\n')
}

// Swap every working glyph for the current spinner frame. ◆ appears only as a
// working-row lead, so a global replace is safe and survives scrolling.
export const spinnerizeWar = (text, frame) => text.replace(/◆/g, frame)
