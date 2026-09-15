# Package Validator

[![CI](https://github.com/mmayadag/package-validator/actions/workflows/ci.yml/badge.svg)](https://github.com/mmayadag/package-validator/actions/workflows/ci.yml)

Point it at a public GitHub repository and get a report of which `package.json` dependencies have newer versions. Optionally emails the report on a schedule.

| Directory | What it is | Stack |
|---|---|---|
| [`api/`](api) | REST API: validates the repo through the GitHub GraphQL API, fetches `package.json` and runs `npm-check-updates` on it | NestJS · TypeScript · SendGrid |
| [`ui/`](ui) | Single-page front end | Svelte · Rollup |

Both were separate repositories ([package-validator-api](https://github.com/mmayadag/package-validator-api), [package-validator-ui](https://github.com/mmayadag/package-validator-ui)); they were merged here with `git subtree` so the full history is preserved.

## Run with Docker

```bash
cp .env.example .env    # set TOKEN to a GitHub token
docker compose up --build
```

Open http://localhost:8080. The UI container (Caddy) serves the Svelte bundle and proxies `/repo/*` to the API container, so no CORS configuration is needed.

## Run locally

```bash
# API — http://localhost:3288
cd api && yarn install && yarn start:dev

# UI — http://localhost:5000
cd ui && npm install && npm run dev
```

When running outside Docker the UI calls the API on its own origin; point it at the API with a reverse proxy or by editing `api` in `ui/src/pages/Repo.svelte`.

## API

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| `GET` | `/repo/isValid/:owner/:repo` | — | `{ "valid": boolean }` |
| `POST` | `/repo/isValid` | `{ "owner", "repo" }` | `{ "valid": boolean }` |
| `GET` | `/repo/details/:owner/:repo` | — | Outdated dependencies report |
| `POST` | `/repo/schedule` | `{ "owner", "repo", "email", "period": 6 \| 12 \| 24 }` | Report; emails it when `SENDGRID_API_KEY` is set |

## Configuration

See [`.env.example`](.env.example). `TOKEN` (GitHub) is required; SendGrid variables are optional.

## License

MIT
