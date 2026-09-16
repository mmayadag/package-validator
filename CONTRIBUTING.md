# Contributing

Thanks for taking the time. This document covers the workflow; the architecture and module layout are in the [README](README.md) and [`api/README.md`](api/README.md).

## Workflow

1. **Open an issue first.** Every change, including your own, starts as a short issue on the [project board](https://github.com/users/mmayadag/projects/5). Use the [Task form](https://github.com/mmayadag/package-validator/issues/new?template=task.yml): *Why* (the problem, one or two sentences), *What* (the change, a few bullets) and *Acceptance criteria* (checks a reviewer can run). Bugs and feature ideas have their own [forms](https://github.com/mmayadag/package-validator/issues/new/choose).
2. **Branch from `main`** and keep the change focused on that one issue.
3. **Commit with [Conventional Commits](https://www.conventionalcommits.org/)**, using the issue number as the scope and closing it from the body:

   ```
   feat(#42): cache dependency reports for an hour

   Closes #42
   ```

   Types in use: `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `chore`. Releases and the changelog are generated from these messages, so the subject line should describe the change for a reader of the changelog.
4. **Open a pull request** with the template: what changed, why, and how to verify it. Keep it as short as the change allows. CI runs lint, type checks, unit and e2e tests for both apps and builds the Docker images; all of it must pass.

## Development

Requires Node.js 24.15+ (`.nvmrc`), Yarn 1 for the API and Docker for the full stack.

```bash
make install     # api: yarn install, ui: npm ci
make lint        # oxlint + tsc for the API, svelte-check for the UI
make test        # API unit + e2e tests, UI tests
make up          # full stack on http://localhost:8080
```

The API is native ESM with strict TypeScript; relative imports carry a `.js` extension. Tests use Vitest; e2e tests mock GitHub, npm and SendGrid, so they run offline.

## What a good change looks like

- Behaviour is covered by a unit test and, for a route, an e2e test.
- Anything a third party controls (package names, ranges, tokens) is validated or escaped.
- Documentation that describes the changed behaviour (README, OpenAPI decorators) is updated in the same pull request.
- No secrets in commits; `.env` is ignored and the Docker build context excludes it.

## Reporting a vulnerability

Please do not open a public issue; see [SECURITY.md](SECURITY.md).
