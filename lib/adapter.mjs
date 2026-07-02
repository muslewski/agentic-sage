// Optional per-repo adapter: discover + dynamically import a project's adapter,
// then enrich core results with project names (zone, backlog row). FAIL-CLOSED
// TO CORE: any adapter error → null, never throws — a broken adapter degrades to
// the agnostic P1–P4 behaviour, never crashes the CLI. (Trust model: the adapter
// is the human's own code in their own state dir / repo, like a lint config; we
// don't sandbox, we fail-closed-to-core.)
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { repoDir } from './paths.mjs'

// Discovery order (spec §5, updated by plan 011): <repoRoot>/.agentic-sage/adapter.mjs
// → legacy <repoRoot>/.sage/adapter.mjs (read-alias, pre-rename) → state dir → none.
export const adapterPathFor = (home, repoId, repoRoot) => {
  const candidates = [
    repoRoot && path.join(repoRoot, '.agentic-sage', 'adapter.mjs'),
    repoRoot && path.join(repoRoot, '.sage', 'adapter.mjs'), // legacy read-alias
    path.join(repoDir(home, repoId), 'adapter.mjs'),
  ].filter(Boolean)
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c
    } catch {
      /* missing candidate */
    }
  }
  return null
}

export const loadAdapter = async (home, repoId, repoRoot) => {
  const p = adapterPathFor(home, repoId, repoRoot)
  if (!p) return null
  try {
    const mod = await import(pathToFileURL(p).href)
    return mod.default ?? mod
  } catch {
    return null // broken adapter → agnostic core
  }
}

// Enrichment helpers — swallow a null adapter or a throwing method → null, so one
// bad adapter call never breaks a board/territory render.
export const zoneOf = (adapter, ctx, p) => {
  try {
    return adapter?.ownsZone?.(p, ctx) ?? null
  } catch {
    return null
  }
}

export const rowOf = (adapter, ctx, rec) => {
  try {
    return adapter?.claimedWork?.(rec, ctx) ?? null
  } catch {
    return null
  }
}
