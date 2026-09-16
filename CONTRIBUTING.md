# Contributing

Thanks for taking the time. This document covers the workflow; the architecture and module layout are in the [README](README.md) and [`api/README.md`](api/README.md).

## Workflow

1. **Open an issue first.** Every change, including your own, starts as a short issue on the [project board](https://github.com/users/mmayadag/projects/5). Use the [Task form](https://github.com/mmayadag/package-validator/issues/new?template=task.yml): _Why_ (the problem, one or two sentences), _What_ (the change, a few bullets) and _Acceptance criteria_ (checks a reviewer can run). Bugs and feature ideas have their own [forms](https://github.com/mmayadag/package-validator/issues/new/choose).
2. **Branch from `main`** and keep the change focused on that one issue.
3. **Commit with [Conventional Commits](https://www.conventionalcommits.org/)**, using the issue number as the scope and closing it from the body:

   ```
   feat(#42): cache dependency reports for an hour

   Closes #42
   ```

   Types in use: `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `chore`. Releases and the changelog are generated from these messages, so the subject line should describe the change for a reader of the changelog.

4. **Open a pull request** with the template: what changed, why, and how to verify it. Keep it as short as the change allows. CI runs lint, type checks, unit and e2e tests for both apps and builds the Docker images; all of it must pass.

## Development

Requires Node.js 24.15+ (`.nvmrc`) and Docker for the full stack. `api`, `ui` and `packages/contracts` are npm workspaces sharing one lockfile; the contracts package holds the request and response types both apps use and must be built before the others (`make install` does it).

```bash
make install     # npm ci for every workspace, then builds packages/contracts
make lint        # prettier --check, oxlint, tsc for the API, svelte-check for the UI
make test        # API unit + e2e tests, UI unit + component tests
make smoke       # Playwright against the running stack (make up first)
make up          # full stack on http://localhost:8080
```

The API is native ESM with strict TypeScript; relative imports carry a `.js` extension. Tests use Vitest; the API e2e suite mocks GitHub, npm and SendGrid and runs in random order, so every test has to stand on its own. UI components are tested with Testing Library. Formatting is Prettier's; `make format` rewrites everything and CI rejects anything it would change.

## What a good change looks like

- Behaviour is covered by a unit test and, for a route, an e2e test.
- Anything a third party controls (package names, ranges, tokens) is validated or escaped.
- Documentation that describes the changed behaviour (README, OpenAPI decorators) is updated in the same pull request.
- No secrets in commits; `.env` is ignored and the Docker build context excludes it.

## Reporting a vulnerability

Please do not open a public issue; see [SECURITY.md](SECURITY.md).
