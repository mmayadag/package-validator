<script lang="ts">
  import { ApiError, type ConfirmedSubscription, confirmSubscription } from '../lib/api';

  let { token }: { token: string } = $props();

  type Status = 'confirm' | 'working' | 'done' | 'gone' | 'error';
  let status = $state<Status>('confirm');
  let result = $state<ConfirmedSubscription | null>(null);

  async function confirm() {
    status = 'working';
    try {
      result = await confirmSubscription(token);
      status = 'done';
    } catch (error) {
      // 400: malformed link, 404: expired or removed
      status = error instanceof ApiError && (error.status === 400 || error.status === 404) ? 'gone' : 'error';
    }
  }
</script>

<section class="card" aria-labelledby="confirm-title" aria-live="polite">
  {#if status === 'done' && result}
    <h2 id="confirm-title">Subscription confirmed</h2>
    <p>
      The report for <strong>{result.owner}/{result.repo}</strong> is on its way to {result.email} and will follow
      every {result.subscription.periodHours} hours. Every email has an unsubscribe link.
    </p>
  {:else if status === 'gone'}
    <h2 id="confirm-title">This link is no longer valid</h2>
    <p>Confirmation links expire after 24 hours. Subscribe again to get a new one.</p>
  {:else}
    <h2 id="confirm-title">Confirm your subscription</h2>
    <p>Click below to start receiving the dependency report at this address.</p>
    <button type="button" class="primary" onclick={confirm} disabled={status === 'working'}>
      {status === 'working' ? 'Confirming…' : 'Confirm subscription'}
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
