<script lang="ts">
  import { ApiError, unsubscribe } from '../lib/api';

  let { token }: { token: string } = $props();

  type Status = 'confirm' | 'working' | 'done' | 'gone' | 'error';
  let status = $state<Status>('confirm');

  async function confirm() {
    status = 'working';
    try {
      await unsubscribe(token);
      status = 'done';
    } catch (error) {
      // 400: malformed link, 404: already removed; both mean there is nothing left to do
      status = error instanceof ApiError && (error.status === 400 || error.status === 404) ? 'gone' : 'error';
    }
  }
</script>

<section class="card" aria-labelledby="unsubscribe-title" aria-live="polite">
  {#if status === 'done'}
    <h2 id="unsubscribe-title">You are unsubscribed</h2>
    <p>You will not receive this dependency report anymore.</p>
  {:else if status === 'gone'}
    <h2 id="unsubscribe-title">This link is no longer valid</h2>
    <p>The subscription has already been removed.</p>
  {:else}
    <h2 id="unsubscribe-title">Stop receiving this report?</h2>
    <p>You can subscribe again at any time.</p>
    <button type="button" class="primary" onclick={confirm} disabled={status === 'working'}>
      {status === 'working' ? 'Unsubscribing…' : 'Unsubscribe'}
    </button>
    {#if status === 'error'}
      <p class="alert" role="alert">Something went wrong. Please try again.</p>
    {/if}
  {/if}

  <a href="/">Back to Package Validator</a>
</section>

<style>
  .card {
    display: grid;
    gap: 1rem;
    justify-items: start;
    padding: 1.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  p {
    margin: 0;
    color: var(--muted);
  }

  .alert {
    padding: 0.75rem 1rem;
    border-radius: calc(var(--radius) / 2);
    background: var(--danger-soft);
    color: var(--danger);
  }
</style>
