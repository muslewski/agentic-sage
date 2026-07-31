<script lang="ts">
  import { onMount } from 'svelte';
  import Island from '../components/Island.svelte';
  import { buildCollapsedView } from '$lib/density';
  import { fetchBoard, fetchHeat } from '$lib/sageClient';
  import type { CollapsedView } from '$lib/types';
  import '../styles/glass.css';

  const POLL_MS = 1500;

  type PollStatus = 'ok' | 'loading' | 'error' | 'missing' | 'empty';

  let view: CollapsedView | null = $state(null);
  let status: PollStatus = $state('loading');

  function classifyError(err: unknown): 'missing' | 'error' {
    const msg = err instanceof Error ? err.message : String(err ?? '');
    if (
      /not found on PATH/i.test(msg) ||
      /SAGE_BIN/i.test(msg) ||
      /sage binary/i.test(msg) ||
      /No such file/i.test(msg)
    ) {
      return 'missing';
    }
    return 'error';
  }

  async function pollOnce(): Promise<void> {
    try {
      const [board, heat] = await Promise.all([fetchBoard(), fetchHeat()]);
      const next = buildCollapsedView(board.sessions ?? [], heat);
      view = next;
      status = next.pills.length === 0 ? 'empty' : 'ok';
    } catch (err) {
      status = classifyError(err);
      // Keep last good view on transient error; clear only on missing binary.
      if (status === 'missing') {
        view = null;
      }
    }
  }

  onMount(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = async () => {
      if (cancelled) return;
      await pollOnce();
      if (cancelled) return;
      timer = setTimeout(loop, POLL_MS);
    };

    void loop();

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  });
</script>

<main class="island-root">
  <Island {view} {status} />
</main>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: transparent;
  }

  .island-root {
    box-sizing: border-box;
    width: 100vw;
    height: 100vh;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    -webkit-app-region: drag;
    app-region: drag;
  }
</style>
