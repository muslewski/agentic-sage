<script lang="ts">
  import { onMount } from 'svelte';
  import Island from '../components/Island.svelte';
  import Peek from '../components/Peek.svelte';
  import ExpandPanel from '../components/ExpandPanel.svelte';
  import { buildCollapsedView, isLiveSession } from '$lib/density';
  import {
    fetchBoard,
    fetchHeat,
    getSageTransport,
    type SageTransportInfo,
  } from '$lib/sageClient';
  import type { BoardEnvelope, CollapsedView, SageSession } from '$lib/types';
  import { fitIslandWindow, type UiMode } from '$lib/windowFit';
  import '../styles/glass.css';

  const POLL_MS = 1500;

  type PollStatus = 'ok' | 'loading' | 'error' | 'missing' | 'empty';

  let view: CollapsedView | null = $state(null);
  let status: PollStatus = $state('loading');
  let sessions: SageSession[] = $state([]);
  let board: BoardEnvelope | null = $state(null);
  let transport: SageTransportInfo | null = $state(null);

  let mode: UiMode = $state('collapsed');
  let hoverId: string | null = $state(null);

  const peekSession = $derived.by((): SageSession | null => {
    if (!hoverId) return null;
    return sessions.find((s) => s.session_id === hoverId) ?? null;
  });

  function classifyError(err: unknown): 'missing' | 'error' {
    const msg = err instanceof Error ? err.message : String(err ?? '');
    if (
      /not found on PATH/i.test(msg) ||
      /SAGE_BIN/i.test(msg) ||
      /SAGE_REMOTE/i.test(msg) ||
      /sage binary/i.test(msg) ||
      /No such file/i.test(msg) ||
      /Permission denied/i.test(msg) ||
      /Could not resolve hostname/i.test(msg) ||
      /Connection timed out/i.test(msg) ||
      /Connection refused/i.test(msg)
    ) {
      return 'missing';
    }
    return 'error';
  }

  async function ensureTransport(): Promise<SageTransportInfo> {
    if (transport) return transport;
    const t = await getSageTransport();
    transport = t;
    return t;
  }

  async function pollOnce(): Promise<void> {
    try {
      const t = await ensureTransport();
      const [nextBoard, heat] = await Promise.all([fetchBoard(t), fetchHeat(t)]);
      board = nextBoard;
      sessions = nextBoard.sessions ?? [];
      const next = buildCollapsedView(sessions, heat);
      view = next;
      status = next.pills.length === 0 ? 'empty' : 'ok';
      // Drop hover if session vanished.
      if (hoverId && !sessions.some((s) => s.session_id === hoverId && isLiveSession(s))) {
        hoverId = null;
        if (mode === 'peek') mode = 'collapsed';
      }
    } catch (err) {
      status = classifyError(err);
      // Keep last good view on transient error; clear only on missing binary / dead remote.
      if (status === 'missing') {
        view = null;
        sessions = [];
        board = null;
      }
    }
  }

  function setMode(next: UiMode, id: string | null = hoverId) {
    mode = next;
    if (next === 'collapsed') {
      hoverId = null;
    } else if (id !== undefined) {
      hoverId = id;
    }
    void fitIslandWindow(next);
  }

  function pin(sessionId: string | null = null) {
    const id =
      sessionId ??
      hoverId ??
      view?.pills[0]?.session_id ??
      null;
    setMode('pinned', id);
  }

  function collapse() {
    setMode('collapsed', null);
  }

  function onPillEnter(sessionId: string) {
    if (mode === 'pinned') {
      hoverId = sessionId;
      return;
    }
    hoverId = sessionId;
    if (mode !== 'peek') {
      mode = 'peek';
      void fitIslandWindow('peek');
    }
  }

  function onPillLeave() {
    // Leave handled by shell leave / delayed collapse — keep strip while moving to peek UI.
  }

  function onShellEnter() {
    if (mode === 'pinned') return;
    if (!hoverId && view?.pills[0]) {
      hoverId = view.pills[0].session_id;
    }
    if (mode === 'collapsed' && hoverId) {
      mode = 'peek';
      void fitIslandWindow('peek');
    }
  }

  function onShellLeave() {
    if (mode === 'peek') {
      collapse();
    }
  }

  function onRootClick(e: MouseEvent) {
    if (mode !== 'pinned') return;
    const t = e.target as HTMLElement | null;
    // Click outside chrome (transparent root) collapses.
    if (t?.closest('.island-chrome')) return;
    collapse();
  }

  function onKeydown(e: KeyboardEvent) {
    // Esc collapses pin/peek
    if (e.key === 'Escape') {
      if (mode !== 'collapsed') {
        e.preventDefault();
        collapse();
      }
      return;
    }
    // Window-focused hide toggle (global shortcut also wired in Rust when available).
    // Meta/Ctrl + Shift + \
    const isHide =
      e.key === '\\' &&
      e.shiftKey &&
      (e.metaKey || e.ctrlKey);
    if (isHide) {
      e.preventDefault();
      void import('$lib/windowFit').then((m) => m.toggleIslandVisible());
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
    void fitIslandWindow('collapsed');

    window.addEventListener('keydown', onKeydown);

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener('keydown', onKeydown);
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<main class="island-root" data-ui={mode} onclick={onRootClick}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="island-chrome"
    onpointerenter={onShellEnter}
    onpointerleave={onShellLeave}
  >
    <Island
      {view}
      {status}
      {hoverId}
      remoteHost={transport?.mode === 'remote' ? transport.host : null}
      onPillEnter={onPillEnter}
      onPillLeave={onPillLeave}
      onPillClick={(id) => pin(id)}
      onShellClick={() => pin()}
      onHeatClick={() => pin(null)}
    />

    {#if mode === 'peek' && peekSession}
      <Peek session={peekSession} />
    {/if}

    {#if mode === 'pinned'}
      <ExpandPanel
        {sessions}
        {board}
        focusId={hoverId}
        {transport}
        onCollapse={collapse}
      />
    {/if}
  </div>
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
    align-items: flex-start;
    justify-content: center;
    padding-top: 4px;
    background: transparent;
    -webkit-app-region: drag;
    app-region: drag;
  }

  .island-chrome {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 100%;
    max-height: 100%;
    -webkit-app-region: no-drag;
    app-region: no-drag;
  }
</style>
