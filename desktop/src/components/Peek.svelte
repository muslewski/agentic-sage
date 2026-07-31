<script lang="ts">
  import type { Liveness, SageSession } from '$lib/types';
  import { sessionLabel } from '$lib/labels';

  interface Props {
    session: SageSession | null;
  }

  let { session }: Props = $props();

  function claimSnippet(s: SageSession): string[] {
    const globs = s.claimed_globs ?? [];
    return globs.slice(0, 2);
  }

  function livenessLabel(l: Liveness): string {
    return l;
  }
</script>

{#if session}
  <div class="peek-strip" role="tooltip" data-session={session.session_id}>
    <div class="peek-line">
      <span class="island-dot" data-liveness={session.liveness} aria-hidden="true"></span>
      <span class="peek-label">{sessionLabel(session)}</span>
      <span class="peek-live">{livenessLabel(session.liveness)}</span>
    </div>
    {#if claimSnippet(session).length > 0}
      <div class="peek-claims">
        {#each claimSnippet(session) as g (g)}
          <code class="peek-glob">{g}</code>
        {/each}
      </div>
    {:else}
      <div class="peek-claims peek-muted">no claims</div>
    {/if}
  </div>
{/if}

<style>
  .peek-strip {
    box-sizing: border-box;
    width: 100%;
    max-width: 28rem;
    margin-top: 6px;
    padding: 8px 12px;
    border-radius: 14px;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(var(--glass-blur)) saturate(160%);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(160%);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    color: var(--island-fg);
    font: 11px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif;
    -webkit-app-region: no-drag;
    app-region: no-drag;
  }

  .peek-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .peek-label {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .peek-live {
    margin-left: auto;
    color: var(--island-muted);
    text-transform: lowercase;
    flex-shrink: 0;
  }

  .peek-claims {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin-top: 6px;
  }

  .peek-glob {
    font: 10px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: color-mix(in srgb, var(--island-fg) 85%, transparent);
    background: rgba(255, 255, 255, 0.06);
    padding: 2px 6px;
    border-radius: 6px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .peek-muted {
    color: var(--island-muted);
  }
</style>
