<script lang="ts">
  import type { ScheduledReport } from '../lib/api';

  let { report }: { report: ScheduledReport } = $props();

  const sections = $derived(Object.entries(report.outdated));
  const total = $derived(sections.reduce((sum, [, packages]) => sum + packages.length, 0));
</script>

<section class="card" aria-labelledby="report-title">
  <header>
    <h2 id="report-title">{report.owner}/{report.repo}</h2>
    <p>
      {total === 0 ? 'All dependencies are up to date.' : `${total} outdated ${total === 1 ? 'dependency' : 'dependencies'}.`}
      {#if report.subscription.status === 'active'}
        {report.emailSent
          ? `The report was emailed to you and will follow every ${report.subscription.periodHours} hours.`
          : 'Email delivery is not configured on this server.'}
      {:else if report.emailSent}
        Check your inbox and confirm the subscription to receive this report every {report.subscription.periodHours} hours.
      {:else}
        Email delivery is not configured on this server, so the subscription cannot be confirmed.
      {/if}
    </p>
  </header>

  {#each sections as [section, packages] (section)}
    <div class="table-wrap">
      <table>
        <caption>{section}</caption>
        <thead>
          <tr><th scope="col">Package</th><th scope="col">Current</th><th scope="col">Latest</th></tr>
        </thead>
        <tbody>
          {#each packages as pkg (pkg.name)}
            <tr>
              <td><a href={`https://www.npmjs.com/package/${pkg.name}`} rel="noreferrer" target="_blank">{pkg.name}</a></td>
              <td><code>{pkg.current}</code></td>
              <td><code>{pkg.latest}</code></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/each}
</section>

<style>
  .card {
    display: grid;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  h2 {
    margin: 0;
    font-size: 1.125rem;
  }

  header p {
    margin: 0.25rem 0 0;
    color: var(--muted);
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9375rem;
  }

  caption {
    text-align: left;
    font-weight: 600;
    padding-bottom: 0.5rem;
  }

  th,
  td {
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  th {
    font-size: 0.8125rem;
    color: var(--muted);
    font-weight: 600;
  }
</style>
