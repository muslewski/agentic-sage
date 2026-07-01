// SAGE project adapter — TEMPLATE. Copy to <repoRoot>/.sage/adapter.mjs
// (or run `sage adapter init`) and fill in what your repo can answer.
//
// An adapter is OPTIONAL per-project enrichment: it teaches SAGE your repo's
// vocabulary so the board/territory show named work + zones instead of bare
// paths. A repo with no adapter is first-class — every function below may stay
// a no-op. Zero dependencies; read-only; `ctx` is always { repoRoot }.
// Full guide: ADAPTERS.md. Worked reference: adapters/acme.mjs.

// Map a repo-relative path → an architectural-zone name (or null).
export const ownsZone = (path, ctx) => null

// Map a session record (its `branch`, etc.) → a tracked work item, or null.
// e.g. read your backlog and return { row: 'D9', status: '🟡' }.
export const claimedWork = (rec, ctx) => null

// Convenience for your own functions (e.g. backlogRows) — the core never
// calls backlogPath; only backlogRows powers `sage backlog`.
export const backlogPath = (ctx) => null

// Globs for THIS repo's generated outputs (lockfiles, codegen, built
// manifests). A contested generated file is flagged "regenerate, don't merge".
export const generatedGlobs = () => []

// Parse your backlog file into rows so `sage backlog` can report who holds each
// row + flag drift: [{ id, status, mission, lands }]. Read `status` from the
// Status column (the row's ✅/🟡/⬜), not the first glyph on the line. Return []
// on a missing/garbage file — never throw.
export const backlogRows = (ctx) => []
