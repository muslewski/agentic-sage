export type Liveness = 'working' | 'idle' | 'stalled' | 'dead' | 'closed';

export interface SageSession {
  session_id: string;
  liveness: Liveness;
  alive?: boolean;
  status?: string;
  branch?: string | null;
  window_name?: string;
  dirty?: boolean;
  claimed_globs?: string[];
  touched_globs?: string[];
  role?: string;
  worktree?: string;
  [key: string]: unknown;
}

export interface BoardEnvelope {
  schema: number;
  kind: string;
  generated_at?: string;
  repo_id?: string | null;
  sessions: SageSession[];
}

export interface Pill {
  session_id: string;
  label: string;
  liveness: Liveness;
}

export interface CollapsedView {
  mode: 'labels' | 'dots';
  pills: Pill[];
  heat: number;
  overflow: number;
}
