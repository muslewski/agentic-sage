#!/usr/bin/env bash
# Regenerate every README demo GIF from staged fixtures. Dev-only.
# Exit nonzero on missing tools, oversized GIFs, or privacy hits.
set -euo pipefail
cd "$(dirname "$0")"
GREEN_DEMO="${GREEN_DEMO:-$HOME/.local/lib/green-demo.sh}"
[ -r "$GREEN_DEMO" ] || {
  echo "green-demo.sh not found — run green-ui-kit/install.sh" >&2
  exit 1
}
# shellcheck disable=SC1090
. "$GREEN_DEMO"
demo_sandbox "$PWD" # exports HOME + 4 XDG vars; runs fixtures/gen.sh
# gen.sh wrote $HOME/bin/{sage,fzf}; keep them first for vhs child shells.
export PATH="$HOME/bin:$PATH"
export NO_COLOR=1
unset FORCE_COLOR 2>/dev/null || true
for tape in scenes/*.tape; do
  demo_record "$tape"
done
