<script lang="ts">
  import type { CollapsedView, Liveness } from '$lib/types';

  interface Props {
    view: CollapsedView | null;
    status: 'ok' | 'loading' | 'error' | 'missing' | 'empty';
  }

  let { view, status }: Props = $props();

  function livenessTitle(l: Liveness): string {
    return l;
  }
</script>

<div
  class="island-shell"
  role="status"
  aria-live="polite"
  data-mode={view?.mode ?? 'none'}
  data-status={status}
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
      <span class="island-pill" title="{pill.label} · {livenessTitle(pill.liveness)}">
        <span
          class="island-dot"
          data-liveness={pill.liveness}
          aria-hidden="true"
        ></span>
        <span class="island-label">{pill.label}</span>
      </span>
    {/each}
  {:else}
    <span class="island-dots-row" aria-label="{view.pills.length} live sessions">
      {#each view.pills as pill (pill.session_id)}
        <span
          class="island-dot"
          data-liveness={pill.liveness}
          title="{pill.label} · {livenessTitle(pill.liveness)}"
        ></span>
      {/each}
    </span>
  {/if}

  {#if view && view.heat > 0}
    <span class="island-heat" title="{view.heat} contested path(s)" aria-label="heat {view.heat}">
      ⚠ {view.heat}
    </span>
  {/if}
</div>
