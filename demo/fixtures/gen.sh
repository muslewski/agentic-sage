#!/usr/bin/env bash
# Stage a sandbox fleet: three tiny git repos (atlas, beacon, lumen) plus
# sage wiring + live session rows with zones/ctx gauges/sparklines.
# Invoked by demo_sandbox under a throwaway HOME/XDG — never the real one.
set -euo pipefail

# DEMO_ANCHOR_EPOCH / HOME / XDG_* are exported by demo_sandbox before we run.
: "${HOME:?gen.sh expects HOME from demo_sandbox}"
: "${DEMO_ANCHOR_EPOCH:?gen.sh expects DEMO_ANCHOR_EPOCH from demo_sandbox}"

# This script lives at <repo>/demo/fixtures/gen.sh → repo root is ../..
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# --- PATH shims (persist via files under $HOME; record.sh puts $HOME/bin first) ---
mkdir -p "$HOME/bin" "$HOME/src"

# sage → this worktree's CLI (no color env — pty detection is natural).
cat >"$HOME/bin/sage" <<EOF
#!/usr/bin/env bash
exec node "$ROOT/bin/sage" "\$@"
EOF
chmod +x "$HOME/bin/sage"

# Shadow real fzf so TTY board/repos print the plain roster (not a jump picker).
# tryBoardFzfJump / tryReposFzfJump catch non-zero and fall through.
cat >"$HOME/bin/fzf" <<'EOF'
#!/bin/sh
exit 1
EOF
chmod +x "$HOME/bin/fzf"

export PATH="$HOME/bin:$PATH"

# --- Wire SAGE (global + grok + enabled) so doctor hits 11/11 inside a repo ---
node "$ROOT/bin/sage" init --global --harness both --enable >/dev/null

# --- Tiny git repos under $HOME/src/{atlas,beacon,lumen} ---
mkrepo() {
  local name=$1
  local dir="$HOME/src/$name"
  mkdir -p "$dir/src/api" "$dir/src/ui" "$dir/lib" "$dir/docs"
  git -C "$dir" init -q -b main
  git -C "$dir" config user.email "demo@example.com"
  git -C "$dir" config user.name "demo"
  printf '# %s\n' "$name" >"$dir/README.md"
  printf 'export const x = 1\n' >"$dir/src/api/handlers.ts"
  printf 'export const y = 1\n' >"$dir/src/ui/App.tsx"
  printf 'module.exports = {}\n' >"$dir/lib/util.js"
  printf 'notes\n' >"$dir/docs/README.md"
  git -C "$dir" add -A
  git -C "$dir" commit -qm "init"
  git -C "$dir" checkout -qb "feat/${name}-core"
  printf '// work\n' >>"$dir/src/api/handlers.ts"
  git -C "$dir" add -A
  git -C "$dir" commit -qm "wip"
  printf '%s\n' "$dir"
}

atlas=$(mkrepo atlas)
beacon=$(mkrepo beacon)
lumen=$(mkrepo lumen)

id_of() {
  node --input-type=module -e \
    "import { resolveRepoId } from 'file://${ROOT}/lib/repo-id.mjs'; console.log(resolveRepoId(process.argv[1]))" \
    "$1"
}

aid=$(id_of "$atlas")
bid=$(id_of "$beacon")
lid=$(id_of "$lumen")

# ISO timestamp relative to DEMO_ANCHOR_EPOCH (seconds offset, may be negative).
iso() {
  date -u -d "@$((DEMO_ANCHOR_EPOCH + $1))" +%Y-%m-%dT%H:%M:%S.000Z
}

# Write a session record, then register claimed globs via sage claim (CLI).
# Args: sid repo_path branch globs_csv ctx_used ctx_window age_off last_tool_off window_name
seed() {
  local sid=$1 repo_path=$2 branch=$3 globs_csv=$4
  local ctx_used=$5 ctx_win=$6 age_off=$7 last_tool_off=$8 window_name=$9
  local rid sdir updated last_tool opened globs_json
  rid=$(id_of "$repo_path")
  sdir="$HOME/.claude/agentic-sage/repos/${rid}/sessions"
  mkdir -p "$sdir"
  updated=$(iso "$age_off")
  last_tool=$(iso "$last_tool_off")
  opened=$(iso -7200)
  globs_json=$(
    printf '%s' "$globs_csv" | node -e "
      let s = ''
      process.stdin.on('data', (d) => { s += d })
      process.stdin.on('end', () => {
        console.log(JSON.stringify(s.trim().split(',').filter(Boolean)))
      })
    "
  )
  cat >"$sdir/${sid}.json" <<JSON
{
  "session_id": "$sid",
  "repo_id": "$rid",
  "worktree": "$repo_path",
  "branch": "$branch",
  "head": "abc1234",
  "dirty": true,
  "touched_globs": $globs_json,
  "trunk": "main",
  "pid": 1,
  "link_state": "linked",
  "source": "startup",
  "status": "active",
  "managed_by": "human",
  "window_name": "$window_name",
  "agent_kind": "claude",
  "opened_at": "$opened",
  "updated_at": "$updated",
  "last_prompt_at": "$updated",
  "last_tool_at": "$last_tool",
  "ctx_used": $ctx_used,
  "ctx_window": $ctx_win
}
JSON
  # shellcheck disable=SC2086
  (cd "$repo_path" && SAGE_SELF_SID="$sid" sage claim $globs_csv) >/dev/null
  # claim stamps updated_at=now — restore the anchor-relative age so board
  # ages and repos sparklines stay deterministic.
  node -e "
    const fs = require('fs')
    const p = process.argv[1]
    const at = process.argv[2]
    const j = JSON.parse(fs.readFileSync(p, 'utf8'))
    j.updated_at = at
    j.last_prompt_at = at
    j.last_tool_at = j.last_tool_at ? process.argv[3] : j.last_tool_at
    fs.writeFileSync(p, JSON.stringify(j, null, 2))
  " "$sdir/${sid}.json" "$updated" "$last_tool"
}

# Live sessions — zones from touched_globs, ctx gauges from ctx_used/window.
# age offsets near 0 so board shows "just now" / few minutes; last_tool recent ⇒ working.
seed "atlas-alpha" "$atlas" "feat/atlas-core" "src/api/handlers.ts" 92000 200000 -90 -50 "atlas-auth"
seed "atlas-beta" "$atlas" "feat/atlas-ui" "src/ui/App.tsx" 45000 200000 -240 -200 "atlas-ui"
seed "beacon-one" "$beacon" "feat/beacon-core" "lib/util.js" 150000 200000 -40 -25 "beacon"
seed "lumen-one" "$lumen" "feat/lumen-core" "src/api/handlers.ts" 30000 200000 -400 -350 "lumen"

# Closed history across ~24h so `sage repos` sparklines show a rising curve.
# 8 buckets × 3h; place activity in several buckets.
i=0
for off in -72000 -54000 -36000 -21600 -10800 -5400; do
  i=$((i + 1))
  sid="atlas-hist${i}"
  seed "$sid" "$atlas" "feat/atlas-hist" "docs/README.md" 10000 200000 "$off" "$off" "hist"
  f="$HOME/.claude/agentic-sage/repos/${aid}/sessions/${sid}.json"
  node -e "
    const fs = require('fs')
    const p = process.argv[1]
    const j = JSON.parse(fs.readFileSync(p, 'utf8'))
    j.status = 'closed'
    j.link_state = 'closed'
    j.pid = 0
    delete j.last_tool_at
    fs.writeFileSync(p, JSON.stringify(j, null, 2))
  " "$f"
done

# Hint file for scene tapes (absolute sandbox paths, never committed).
cat >"$HOME/.sage-demo-repos" <<EOF
ATLAS=$atlas
BEACON=$beacon
LUMEN=$lumen
EOF
