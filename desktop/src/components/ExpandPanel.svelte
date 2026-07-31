<script lang="ts">
  import type { BoardEnvelope, SageSession } from '$lib/types';
  import { sessionLabel } from '$lib/labels';
  import { isLiveSession } from '$lib/density';
  import { copyText, openPath } from '$lib/sageClient';

  interface Props {
    sessions: SageSession[];
    board: BoardEnvelope | null;
    focusId?: string | null;
    onCollapse?: () => void;
  }

  let { sessions, board, focusId = null, onCollapse }: Props = $props();

  let toast: string | null = $state(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const live = $derived(sessions.filter(isLiveSession));

  function flash(msg: string) {
    toast = msg;
    if (toastTimer !== undefined) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast = null;
    }, 1400);
  }

  async function doCopy(label: string, text: string) {
    try {
      await copyText(text);
      flash(`Copied ${label}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Copy failed');
    }
  }

  async function doOpen(path: string) {
    try {
      await openPath(path);
      flash('Opened path');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Open failed');
    }
  }

  function claimsText(s: SageSession): string {
    const g = s.claimed_globs ?? [];
    return g.length ? g.join('\n') : '';
  }

  function boardJson(): string {
    if (!board) return '{}';
    try {
      return JSON.stringify(board, null, 2);
    } catch {
      return '{}';
    }
  }
</script>

<div class="expand-panel" role="dialog" aria-label="SAGE sessions" data-focus={focusId ?? ''}>
  <header class="expand-head">
    <span class="expand-title">Live sessions · {live.length}</span>
    <div class="expand-head-actions">
      <button
        type="button"
        class="soft-btn"
        title="Copy board snapshot JSON"
        onclick={() => doCopy('board JSON', boardJson())}
      >
        Copy board
      </button>
      <button
        type="button"
        class="soft-btn soft-btn-ghost"
        title="Collapse (Esc)"
        onclick={() => onCollapse?.()}
      >
        ✕
      </button>
    </div>
  </header>

  {#if toast}
    <div class="expand-toast" role="status">{toast}</div>
  {/if}

  <div class="expand-list">
    {#if live.length === 0}
      <p class="expand-empty">No live sessions</p>
    {:else}
      {#each live as s (s.session_id)}
        <article
          class="session-row"
          class:focused={focusId === s.session_id}
          data-session={s.session_id}
        >
          <div class="session-meta">
            <span class="island-dot" data-liveness={s.liveness} aria-hidden="true"></span>
            <div class="session-text">
              <div class="session-label">{sessionLabel(s)}</div>
              <div class="session-sub">
                <span>{s.liveness}</span>
                {#if s.role}
                  <span>· {s.role}</span>
                {/if}
                {#if s.dirty}
                  <span class="dirty">· dirty</span>
                {/if}
              </div>
              {#if (s.claimed_globs ?? []).length > 0}
                <div class="session-claims">
                  {#each (s.claimed_globs ?? []).slice(0, 4) as g (g)}
                    <code class="claim-chip">{g}</code>
                  {/each}
                  {#if (s.claimed_globs ?? []).length > 4}
                    <span class="claim-more">+{(s.claimed_globs ?? []).length - 4}</span>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
          <div class="session-actions">
            <button
              type="button"
              class="soft-btn"
              title="Copy session id"
              onclick={() => doCopy('session id', s.session_id)}
            >
              Id
            </button>
            <button
              type="button"
              class="soft-btn"
              title="Copy claimed globs"
              disabled={!claimsText(s)}
              onclick={() => doCopy('claims', claimsText(s))}
            >
              Claims
            </button>
            {#if s.worktree}
              <button
                type="button"
                class="soft-btn"
                title="Open worktree"
                onclick={() => doOpen(String(s.worktree))}
              >
                Open
              </button>
            {/if}
          </div>
        </article>
      {/each}
    {/if}
  </div>
</div>

<style>
  .expand-panel {
    box-sizing: border-box;
    width: min(100%, 24rem);
    max-height: min(420px, 70vh);
    margin-top: 8px;
    padding: 10px 10px 12px;
    border-radius: 18px;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(var(--glass-blur)) saturate(160%);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(160%);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    color: var(--island-fg);
    font: 12px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif;
    display: flex;
    flex-direction: column;
    gap: 8px;
    -webkit-app-region: no-drag;
    app-region: no-drag;
    overflow: hidden;
  }

  .expand-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 2px 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .expand-title {
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .expand-head-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .expand-toast {
    font-size: 11px;
    color: #b8f5c4;
    padding: 2px 4px;
  }

  .expand-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    flex: 1;
  }

  .expand-empty {
    margin: 12px 4px;
    color: var(--island-muted);
  }

  .session-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 8px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid transparent;
  }

  .session-row.focused {
    border-color: rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.07);
  }

  .session-meta {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
  }

  .session-text {
    min-width: 0;
    flex: 1;
  }

  .session-label {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-sub {
    color: var(--island-muted);
    font-size: 11px;
    margin-top: 2px;
  }

  .dirty {
    color: #ffd60a;
  }

  .session-claims {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }

  .claim-chip {
    font: 10px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    padding: 2px 5px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.06);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .claim-more {
    font-size: 10px;
    color: var(--island-muted);
    align-self: center;
  }

  .session-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .soft-btn {
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.08);
    color: var(--island-fg);
    border-radius: 8px;
    padding: 4px 9px;
    font: inherit;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    -webkit-app-region: no-drag;
    app-region: no-drag;
  }

  .soft-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.14);
  }

  .soft-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .soft-btn-ghost {
    background: transparent;
    min-width: 1.75rem;
    padding-inline: 6px;
  }
</style>
