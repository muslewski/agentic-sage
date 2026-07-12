// Session provenance: was this session launched by a human (driving it through a
// tmux pane) or spawned by an agent (nested)? Pure over injected readers so it
// unit-tests without a real process tree. See docs spec
// 2026-07-12-session-provenance-design.md. Never throws — an unclassifiable
// session is treated as `nested` (a background agent), never a phantom human root.
import { ppidOf as realPpidOf, commOf as realCommOf, cmdlineOf as realCmdlineOf } from './tmux.mjs'

// An "agent" ancestor: a coding-agent process (claude/grok by comm) OR our
// armory/llm launcher (node-based → inspect the command line). Readers injected
// for tests; default to the real /proc readers.
export const isAgent = (pid, { commOf = realCommOf, cmdlineOf = realCmdlineOf } = {}) => {
  if (/^(claude|grok)$/i.test(commOf(pid))) return true
  return /(?:^|\/)(claude|grok|armory|llm)(?:\s|$)|llm-armory/i.test(cmdlineOf(pid))
}

// Classify the session whose OWN agent process is `pid` (= process.ppid at hook
// time). Precedence: launcher tag > process tree > headless.
export const classifyParent = ({
  pid,
  env = {},
  panes = [],
  ppidOf = realPpidOf,
  isAgent: agent = isAgent,
} = {}) => {
  const tag = env.SAGE_PARENT
  if (typeof tag === 'string' && tag.trim())
    return { managed_by: 'nested', parent_sid: tag.trim(), via: 'tag' }
  const paneByPid = new Set(panes.map((p) => p.panePid))
  let cur = ppidOf(pid) // start at the PARENT — pid itself is this session's own agent
  for (let hop = 0; hop < 30 && cur > 1; hop++) {
    if (paneByPid.has(cur)) return { managed_by: 'human', parent_sid: null, via: 'tree' }
    if (agent(cur)) return { managed_by: 'nested', parent_sid: null, via: 'tree' }
    cur = ppidOf(cur)
  }
  return { managed_by: 'nested', parent_sid: null, via: 'headless' }
}
