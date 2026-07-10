// lib/harness.mjs — where each AI harness keeps its settings/hooks/skills.
// One row per harness; everything scope- or storage-related derives from a
// profile, never from a hardcoded '.claude' string outside this file.
import path from 'node:path'

export const HARNESSES = {
  claude: {
    id: 'claude',
    home: (h) => path.join(h, '.claude'),
    settings: (h) => path.join(h, '.claude', 'settings.json'),
    projectSettings: (root) => path.join(root, '.claude', 'settings.json'),
    hooksDir: (h) => path.join(h, '.claude', 'hooks'),
    skillsDir: (h) => path.join(h, '.claude', 'skills'),
    storageDefault: (h) => path.join(h, '.claude', 'agentic-sage'),
    tmux: true,
  },
  // Grok Build CLI native paths. Note: hooks are individual *.json files under
  // hooksDir (not merged into settings.json). Grok also reads .claude/* via
  // [compat.claude] (default on) so claude-profile wiring works for Grok users too.
  grok: {
    id: 'grok',
    home: (h) => path.join(h, '.grok'),
    settings: (h) => path.join(h, '.grok', 'config.toml'), // not used for hooks; native hooks live in hooksDir/*.json
    projectSettings: (root) => path.join(root, '.grok', 'config.toml'),
    hooksDir: (h) => path.join(h, '.grok', 'hooks'),
    skillsDir: (h) => path.join(h, '.grok', 'skills'),
    // SAGE state stays under the claude agent dir for cross-harness compatibility
    // (Grok honors .claude settings/skills/hooks). Can be overridden via storage.
    storageDefault: (h) => path.join(h, '.claude', 'agentic-sage'),
    tmux: true,
  },
}

export const getHarness = (id = 'claude') => HARNESSES[id] || null
