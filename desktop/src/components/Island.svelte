<script lang="ts">
  import type { CollapsedView, Liveness } from '$lib/types';

  interface Props {
    view: CollapsedView | null;
    status: 'ok' | 'loading' | 'error' | 'missing' | 'empty';
    hoverId?: string | null;
    onPillEnter?: (sessionId: string) => void;
    onPillLeave?: () => void;
    onPillClick?: (sessionId: string) => void;
    onShellClick?: () => void;
    onShellEnter?: () => void;
    onShellLeave?: () => void;
    onHeatClick?: () => void;
  }

  let {
    view,
    status,
    hoverId = null,
    onPillEnter,
    onPillLeave,
    onPillClick,
    onShellClick,
    onShellEnter,
    onShellLeave,
    onHeatClick,
  }: Props = $props();

  function livenessTitle(l: Liveness): string {
    return l;
  }

  function handleShellClick(e: MouseEvent) {
    // Ignore clicks that originated on interactive children (pills/heat handle themselves).
    const t = e.target as HTMLElement | null;
    if (t?.closest('[data-interactive]')) return;
    onShellClick?.();
  }
</script>

<div
  class="island-shell"
  role="status"
  aria-live="polite"
  data-mode={view?.mode ?? 'none'}
  data-status={status}
  data-hover={hoverId ?? ''}
  onpointerenter={() => onShellEnter?.()}
  onpointerleave={() => onShellLeave?.()}
  onclick={handleShellClick}
>
  {#if status === 'missing'}
    <span class="island-status" data-kind="missing">sage?</span>
  {:else if status === 'error'}
    <span class="island-status" data-kind="error">SAGE · …</span>
  {:else if status === 'loading' && !view}
    <span class="island-status" data-kind="loading">SAGE</span>
  {:else if !view || status === 'empty' || view.pills.length === 0}
    <span class="island-status" data-kind="empty">SAGE · 0</span>
  {:else if view.mode === 'labels'}
    {#each view.pills as pill (pill.session_id)}
      <button
        type="button"
        class="island-pill"
        class:hover={hoverId === pill.session_id}
        data-interactive
        title="{pill.label} · {livenessTitle(pill.liveness)}"
        onpointerenter={() => onPillEnter?.(pill.session_id)}
        onpointerleave={() => onPillLeave?.()}
        onclick={(e) => {
          e.stopPropagation();
          onPillClick?.(pill.session_id);
        }}
      >
        <span
          class="island-dot"
          data-liveness={pill.liveness}
          aria-hidden="true"
        ></span>
        <span class="island-label">{pill.label}</span>
      </button>
    {/each}
  {:else}
    <span class="island-dots-row" aria-label="{view.pills.length} live sessions">
      {#each view.pills as pill (pill.session_id)}
        <button
          type="button"
          class="island-dot-btn"
          class:hover={hoverId === pill.session_id}
          data-interactive
          title="{pill.label} · {livenessTitle(pill.liveness)}"
          onpointerenter={() => onPillEnter?.(pill.session_id)}
          onpointerleave={() => onPillLeave?.()}
          onclick={(e) => {
            e.stopPropagation();
            onPillClick?.(pill.session_id);
          }}
        >
          <span class="island-dot" data-liveness={pill.liveness}></span>
        </button>
      {/each}
    </span>
  {/if}

  {#if view && view.heat > 0}
    <button
      type="button"
      class="island-heat"
      data-interactive
      title="{view.heat} contested path(s) — click to expand"
      aria-label="heat {view.heat}"
      onclick={(e) => {
        e.stopPropagation();
        onHeatClick?.();
      }}
    >
      ⚠ {view.heat}
    </button>
  {/if}
</div>

<style>
  .island-pill,
  .island-dot-btn {
    appearance: none;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    padding: 0;
    margin: 0;
    cursor: pointer;
    -webkit-app-region: no-drag;
    app-region: no-drag;
  }

  .island-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    border-radius: 999px;
    padding: 2px 4px;
  }

  .island-pill.hover,
  .island-pill:hover,
  .island-dot-btn.hover,
  .island-dot-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .island-dot-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: 999px;
  }

  .island-heat {
    cursor: pointer;
    font: inherit;
    -webkit-app-region: no-drag;
    app-region: no-drag;
  }
</style>
