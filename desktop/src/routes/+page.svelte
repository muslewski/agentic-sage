<script lang="ts">
  // Sage Island scaffold — empty shell; later tasks wire fleet poll + glass UI.
</script>

<main class="island">
  <p class="label">Sage Island</p>
</main>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: transparent;
  }

  .island {
    box-sizing: border-box;
    width: 100vw;
    height: 100vh;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family:
      ui-sans-serif,
      system-ui,
      -apple-system,
      "Segoe UI",
      sans-serif;
    background: rgba(28, 28, 30, 0.72);
    color: #f5f5f7;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    -webkit-app-region: drag;
    user-select: none;
  }

  .label {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
    opacity: 0.9;
  }
</style>
