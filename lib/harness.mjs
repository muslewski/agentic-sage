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
    storageDefault: (h) => path.join(h, '.claude', 'sage'),
    tmux: true,
  },
}

export const getHarness = (id = 'claude') => HARNESSES[id] || null
