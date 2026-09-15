<script lang="ts">
  import RepositoryCheck from './components/RepositoryCheck.svelte';
</script>

<div class="page">
  <header>
    <div class="logos" aria-hidden="true">
      <img src="/assets/github1.svg" alt="" width="36" height="36" />
      <span>+</span>
      <img src="/assets/npm.svg" alt="" width="36" height="36" />
    </div>
    <h1>Package Validator</h1>
    <p class="lead">
      Point it at a public GitHub repository and see which <code>package.json</code> dependencies have newer
      versions. The report is emailed to you as well.
    </p>
  </header>

  <main>
    <RepositoryCheck />
  </main>

  <footer>
    <a href="https://github.com/mmayadag/package-validator">Source on GitHub</a>
  </footer>
</div>

<style>
  .page {
    max-width: 44rem;
    margin: 0 auto;
    padding: 3rem 1.25rem 2rem;
    display: grid;
    gap: 2rem;
  }

  header {
    text-align: center;
  }

  .logos {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--muted);
  }

  @media (prefers-color-scheme: dark) {
    /* the GitHub mark is solid black */
    .logos img[src*='github'] {
      filter: invert(1);
    }
  }

  h1 {
    margin: 0.75rem 0 0.5rem;
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    letter-spacing: -0.02em;
  }

  .lead {
    margin: 0 auto;
    max-width: 34rem;
    color: var(--muted);
  }

  footer {
    text-align: center;
    font-size: 0.875rem;
  }
</style>
