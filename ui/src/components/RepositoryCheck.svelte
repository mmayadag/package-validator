<script lang="ts">
  import {
    formatPeriod,
    REPORT_PERIODS,
    type ReportPeriod,
    type ScheduledReport,
    isValidRepository,
    scheduleReport,
  } from '../lib/api';
  import { parseRepository } from '../lib/git-url';
  import ReportTable from './ReportTable.svelte';

  type Validity = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

  const EXAMPLE_REPOSITORY = 'mmayadag/bicycle-in-izmir';

  let repositoryInput = $state('');
  let email = $state('');
  let period = $state<ReportPeriod>(24);
  let validity = $state<Validity>('idle');
  let submitting = $state(false);
  let report = $state<ScheduledReport | null>(null);
  let error = $state<string | null>(null);

  const repository = $derived(parseRepository(repositoryInput));
  const canSubmit = $derived(validity === 'valid' && email.includes('@') && !submitting);

  // Check the repository as the user types, debounced and cancelled when the input changes again.
  $effect(() => {
    const ref = repository;
    report = null;
    error = null;

    if (!ref) {
      validity = 'idle';
      return;
    }

    validity = 'checking';
    const controller = new AbortController();
    const timer = setTimeout(() => {
      isValidRepository(ref, controller.signal)
        .then((valid) => (validity = valid ? 'valid' : 'invalid'))
        .catch(() => {
          if (!controller.signal.aborted) validity = 'error';
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!repository || !canSubmit) return;

    submitting = true;
    error = null;
    try {
      report = await scheduleReport({ ...repository, email, period });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Something went wrong';
    } finally {
      submitting = false;
    }
  }

  const STATUS: Record<Validity, string> = {
    idle: 'Enter owner/repo or a GitHub URL.',
    checking: 'Checking the repository…',
    valid: 'Public repository found.',
    invalid: 'Repository not found or not public.',
    error: 'Could not reach the API.',
  };
</script>

<form class="card" onsubmit={submit} novalidate>
  <div class="field">
    <label for="repository">Repository</label>
    <input
      id="repository"
      bind:value={repositoryInput}
      placeholder="owner/repo or https://github.com/owner/repo"
      autocomplete="off"
      spellcheck="false"
      aria-describedby="repository-status"
      aria-invalid={validity === 'invalid'}
    />
    <p id="repository-status" class="hint" data-state={validity} aria-live="polite">
      {STATUS[validity]}
      {#if validity === 'idle'}
        <button type="button" class="link" onclick={() => (repositoryInput = EXAMPLE_REPOSITORY)}>
          Try {EXAMPLE_REPOSITORY}
        </button>
      {/if}
    </p>
  </div>

  <div class="row">
    <div class="field grow">
      <label for="email">Email</label>
      <input id="email" type="email" bind:value={email} placeholder="you@example.com" autocomplete="email" />
    </div>
    <div class="field">
      <label for="period">Every</label>
      <select id="period" bind:value={period}>
        {#each REPORT_PERIODS as hours (hours)}
          <option value={hours}>{formatPeriod(hours)}</option>
        {/each}
      </select>
    </div>
  </div>

  <button type="submit" class="primary" disabled={!canSubmit}>
    {submitting ? 'Analyzing…' : 'Analyze dependencies'}
  </button>

  {#if error}
    <p class="alert" role="alert">{error}</p>
  {/if}
</form>

{#if report}
  <ReportTable {report} />
{/if}

<style>
  .card {
    display: grid;
    gap: 1.25rem;
    padding: 1.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  .field {
    display: grid;
    gap: 0.375rem;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .grow {
    flex: 1 1 16rem;
  }

  label {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }

  .hint[data-state='valid'] {
    color: var(--success);
  }

  .hint[data-state='invalid'],
  .hint[data-state='error'] {
    color: var(--danger);
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
    text-decoration: underline;
  }

  .primary {
    justify-self: start;
  }

  .alert {
    margin: 0;
    padding: 0.75rem 1rem;
    border-radius: calc(var(--radius) / 2);
    background: var(--danger-soft);
    color: var(--danger);
  }
</style>
